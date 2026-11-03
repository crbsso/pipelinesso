import assert from "node:assert/strict";
import test from "node:test";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const A="00000000-0000-4000-8000-000000000001",B="00000000-0000-4000-8000-000000000002",
 C="00000000-0000-4000-8000-000000000003",D="00000000-0000-4000-8000-000000000004";
const P="10000000-0000-4000-8000-000000000001";
const X="20000000-0000-4000-8000-000000000001";
const capacidades=["usuarios","permissoes","solicitacoes_acesso"].map(modulo=>({modulo,acao:"gerenciar"}));
const abrangencias=capacidades.map(c=>({...c,tipo:"corporativa",unidades:[]}));
async function migration(sufixo) {
 const pasta=new URL("../../supabase/migrations/",import.meta.url);
 const nomes=(await readdir(pasta)).filter(n=>n.endsWith(sufixo));
 assert.equal(nomes.length,1);
 return readFile(new URL(nomes[0],pasta),"utf8");
}
test("gestao integrada: privilegios, concorrencia otimista, escopos, auditoria e continuidade",async t=>{
 const db=new PGlite();
 async function como(usuario,op,dados={}) {
  await db.exec("begin");
  try {
   await db.query("select set_config('request.jwt.claim.sub',$1,true)",[usuario??""]);
   await db.exec("set local role authenticated");
   const r=await db.query("select public.gerir_acessos_portal($1,$2::jsonb) as valor",[op,JSON.stringify(dados)]);
   await db.exec("commit");
   return r.rows[0].valor;
  } catch(e) { await db.exec("rollback"); throw e; }
 }
 const rejeita=(promessa,codigo)=>assert.rejects(promessa,e=>e.code===codigo);
 async function usuario(id,ator=A) {return (await como(ator,"listar_usuarios",{limite:100})).dados.find(u=>u.usuario_id===id);}
 async function perfil(id,ator=A) {return (await como(ator,"listar_perfis",{limite:100})).dados.find(p=>p.id===id);}
 async function atribuicoes(id,ator=A) {return (await como(ator,"listar_atribuicoes",{usuarioId:id})).dados;}
 async function auditorias(){return Number((await db.query("select count(*) n from portal_acesso.auditoria")).rows[0].n);}
 try {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
   create schema auth;
   create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,
     banned_until timestamptz,deleted_at timestamptz,is_anonymous boolean default false);
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   grant usage on schema auth to authenticated,anon,service_role;
   grant execute on function auth.uid() to authenticated,anon,service_role;`);
  await db.exec(await migration("_preparar_gestao_acesso_portal.sql"));
  await db.exec(await migration("_criar_permissionamento_portal.sql"));
  for(const [id,email] of [[A,"a@exemplo.test"],[B,"b@exemplo.test"],[C,"c@exemplo.test"],[D,"d@exemplo.test"]])
   await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())",[id,email]);
  await db.exec(`insert into public.perfis_portal(user_id,papel) values('${A}','ADMIN_SSO');
   insert into portal_acesso.perfis(id,codigo,nome) values('${P}','admin_teste','Administracao');
   insert into portal_acesso.permissoes_perfil(perfil_id,modulo,acao)
     select '${P}',m,'gerenciar' from unnest(array['usuarios','permissoes','solicitacoes_acesso']) m;
   insert into portal_acesso.atribuicoes(id,user_id,perfil_id) values('${X}','${A}','${P}');
   insert into portal_acesso.abrangencias(atribuicao_id,perfil_id,modulo,acao,tipo)
     select '${X}','${P}',m,'gerenciar','corporativa' from unnest(array['usuarios','permissoes','solicitacoes_acesso']) m;`);
  await db.exec(await migration("_integrar_gestao_acessos_portal.sql"));
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[A]);
  const contextoAnterior=(await db.query('select public.obter_contexto_acesso_portal() as valor')).rows[0].valor;
  await db.exec(await migration("_herdar_permissoes_do_perfil.sql"));
  await db.exec(await migration("_gerir_exclusao_perfis.sql"));
  assert.deepEqual((await db.query('select public.obter_contexto_acesso_portal() as valor')).rows[0].valor,contextoAnterior);
  assert.equal((await db.query('select herdar_perfil from portal_acesso.atribuicoes where id=$1',[X])).rows[0].herdar_perfil,true);
  await db.query("select set_config('request.jwt.claim.sub','',false)");
  await t.test("anon e service_role nao executam a entrada; auxiliares nao sao publicos",async()=>{
   for(const role of ["anon","service_role"]) {
    await db.exec("begin;set local role "+role);
    await rejeita(db.query("select public.gerir_acessos_portal('listar_usuarios')"),"42501");
    await db.exec("rollback");
   }
   await db.exec("begin;set local role authenticated");
   await rejeita(db.query("select portal_acesso.tem_gestao($1,'usuarios')",[A]),"42501");
   await db.exec("rollback");
   const r=await db.query("select prosecdef from pg_proc where oid='public.gerir_acessos_portal(text,jsonb)'::regprocedure");
   assert.equal(r.rows[0].prosecdef,false);
  });
  await t.test("conta ausente, sem perfil, expirada ou ator enviado no corpo nao concedem gestao",async()=>{
   await rejeita(como(null,"listar_usuarios"),"42501");
   await rejeita(como(B,"listar_usuarios"),"42501");
   await rejeita(como(A,"listar_usuarios",{ator_id:B}),"PT400");
   await rejeita(como(A,"listar_usuarios",{limite:1001}),"PT400");
  });
  await t.test("gestor cadastra identidade USUARIO sem criar conta Auth ou conceder perfil",async()=>{
   await como(A,"salvar_usuario",{id:B,ativo:true,versao:null});
   const u=await usuario(B);
   assert.equal(u.papel_legado,"USUARIO");assert.equal(u.ativo,true);
   assert.equal((await atribuicoes(B)).length,0);
   await rejeita(como(B,"listar_usuarios"),"42501");
   await rejeita(como(A,"salvar_usuario",{id:B,ativo:false,versao:null}),"PT409");
  });
  let tecnico,atribuicao;
  await t.test("perfil e abrangencia nativa explicita sao criados de forma auditada",async()=>{
   tecnico=(await como(A,"salvar_perfil",{codigo:"tecnico",nome:"Equipe tecnica",descricao:"Teste",ativo:true,
    capacidades:[{modulo:"motoristas",acao:"consultar"}]})).perfil;
   atribuicao=(await como(A,"salvar_atribuicao",{usuarioId:B,perfilId:tecnico.id,ativo:true,inicio:null,fim:null,
    abrangencias:[{modulo:"motoristas",acao:"consultar",tipo:"restrita",unidades:[{coligada:"1",secao_rm:"10"},{coligada:"2",secao_rm:"20"}]}]})).atribuicao;
   assert.deepEqual(atribuicao.abrangencias[0].unidades,[{coligada:"1",secao_rm:"10"},{coligada:"2",secao_rm:"20"}]);
   const r=await db.query("select count(*) n from portal_acesso.auditoria where autor_id=$1",[A]);
   assert.ok(Number(r.rows[0].n)>0);
  });
  await t.test("alteracao invalida reverte tambem escopos e auditoria",async()=>{
   const antes=await auditorias();
   await rejeita(como(A,"salvar_atribuicao",{id:atribuicao.id,usuarioId:B,perfilId:tecnico.id,ativo:true,
    inicio:null,fim:null,versao:atribuicao.versao,
    abrangencias:[{modulo:"motoristas",acao:"consultar",tipo:"restrita",unidades:[{secao_rm:"10"}]}]}),"PT400");
   assert.equal(await auditorias(),antes);
   assert.deepEqual((await atribuicoes(B))[0],atribuicao);
  });
  await t.test("uma segunda edicao com versao antiga nao sobrescreve perfil",async()=>{
   await como(A,"salvar_perfil",{id:tecnico.id,codigo:tecnico.codigo,nome:"Tecnicos",descricao:"",ativo:true,
    capacidades:[{modulo:"motoristas",acao:"consultar"}],versao:tecnico.versao});
   await rejeita(como(A,"salvar_perfil",{id:tecnico.id,codigo:tecnico.codigo,nome:"Antigo",ativo:true,
    capacidades:[],versao:tecnico.versao}),"PT409");
   assert.equal((await perfil(tecnico.id)).nome,"Tecnicos");
  });
  await t.test("ultimo administrador nao pode ser bloqueado por identidade, perfil, capacidade ou vigencia",async()=>{
   const antes=await auditorias();
   const u=await usuario(A),p=await perfil(P),a=(await atribuicoes(A))[0];
   await rejeita(como(A,"salvar_usuario",{id:A,ativo:false,versao:u.versao}),"PT409");
   await rejeita(como(A,"salvar_perfil",{id:P,codigo:p.codigo,nome:p.nome,ativo:false,capacidades,versao:p.versao}),"PT409");
   await rejeita(como(A,"salvar_perfil",{id:P,codigo:p.codigo,nome:p.nome,ativo:true,capacidades:capacidades.slice(0,2),versao:p.versao}),"PT409");
   await rejeita(como(A,"salvar_atribuicao",{id:a.id,usuarioId:A,perfilId:P,ativo:true,inicio:null,
    fim:new Date(Date.now()+86400000).toISOString(),abrangencias,versao:a.versao}),"PT409");
   await rejeita(como(A,"estado_atribuicao",{id:a.id,ativo:false,versao:a.versao}),"PT409");
   assert.equal(await auditorias(),antes);
   assert.equal((await usuario(A)).ativo,true);
  });
  await t.test("administrador temporario nao substitui o ultimo permanente; permanente permite transferencia",async()=>{
   await como(A,"salvar_usuario",{id:C,ativo:true,versao:null});
   let a=(await como(A,"salvar_atribuicao",{usuarioId:C,perfilId:P,ativo:true,inicio:null,
    fim:new Date(Date.now()+86400000).toISOString(),abrangencias})).atribuicao;
   let u=await usuario(A);
   await rejeita(como(A,"salvar_usuario",{id:A,ativo:false,versao:u.versao}),"PT409");
   await como(A,"salvar_atribuicao",{id:a.id,usuarioId:C,perfilId:P,ativo:true,inicio:null,fim:null,abrangencias,versao:a.versao});
   await como(A,"salvar_usuario",{id:A,ativo:false,versao:u.versao});
   await rejeita(como(A,"listar_usuarios"),"42501");
   u=await usuario(A,C);
   await como(C,"salvar_usuario",{id:A,ativo:true,versao:u.versao});
   a=(await atribuicoes(C))[0];
   await como(A,"estado_atribuicao",{id:a.id,ativo:false,versao:a.versao});
  });
  await t.test("gestao expirada e ampliacao de papel no corpo sao negadas",async()=>{
   const a=(await atribuicoes(C))[0];
   await como(A,"salvar_atribuicao",{id:a.id,usuarioId:C,perfilId:P,ativo:true,inicio:null,
    fim:new Date(Date.now()-1000).toISOString(),abrangencias,versao:a.versao});
   await rejeita(como(C,"listar_usuarios"),"42501");
   const u=await usuario(B);
   await rejeita(como(A,"salvar_usuario",{id:B,ativo:true,versao:u.versao,papel:"ADMIN_SSO"}),"PT400");
   assert.equal((await usuario(B)).papel_legado,"USUARIO");
  });
  await t.test("analise exige capacidade propria, e aprovar nao provisiona nem concede acesso",async()=>{
   await como(A,"salvar_usuario",{id:D,ativo:true,versao:null});
   const p=(await como(A,"salvar_perfil",{codigo:"analista",nome:"Analise",ativo:true,
    capacidades:[{modulo:"solicitacoes_acesso",acao:"gerenciar"}]})).perfil;
   await como(A,"salvar_atribuicao",{usuarioId:D,perfilId:p.id,ativo:true,inicio:null,fim:null,
    abrangencias:[{modulo:"solicitacoes_acesso",acao:"gerenciar",tipo:"corporativa",unidades:[]}]});
   await rejeita(como(D,"listar_usuarios"),"42501");
   await rejeita(como(D,"listar_perfis"),"42501");
   await rejeita(como(D,"estado_atribuicao",{id:atribuicao.id,ativo:false,versao:atribuicao.versao}),"42501");
   const r=await db.query("insert into public.solicitacoes_acesso(nome_completo,email_corporativo,empresa,cargo_funcao,projeto_unidade,justificativa) values('Pessoa teste','nova@exemplo.test','Empresa','Cargo','Unidade','Justificativa') returning id");
   const id=r.rows[0].id;
   const contas=Number((await db.query("select count(*) n from auth.users")).rows[0].n);
   await como(D,"analisar_solicitacao",{id,acao:"APROVAR",observacao:"Avaliado"});
   await rejeita(como(D,"analisar_solicitacao",{id,acao:"REJEITAR"}),"PT409");
   assert.equal(Number((await db.query("select count(*) n from auth.users")).rows[0].n),contas);
   const audit=await db.query("select autor_id,depois from portal_acesso.auditoria where entidade='public.solicitacoes_acesso'");
   assert.equal(audit.rows[0].autor_id,D);
   assert.deepEqual(Object.keys(audit.rows[0].depois).sort(),["analisado_por","id","status"]);
   assert.equal((await como(D,"listar_solicitacoes",{status:"APROVADO"})).total,1);
  });
  await t.test("heranca: mesmo perfil libera as mesmas abas a dois usuarios sem abrangencias duplicadas",async()=>{
   const {abasDoContexto}=await import('../src/lib/auth/acessoAbas.ts');
   const contexto=async id=>{
    await db.exec('begin');try{await db.query("select set_config('request.jwt.claim.sub',$1,true)",[id]);
     await db.exec('set local role authenticated');return (await db.query('select public.obter_contexto_acesso_portal() as valor')).rows[0].valor;
    }finally{await db.exec('rollback');}
   };
   const edit=async(p,capacidades,ativo=true)=> (await como(A,'salvar_perfil',{id:p.id,codigo:p.codigo,nome:p.nome,descricao:p.descricao,ativo,capacidades,versao:p.versao})).perfil;
   let p=(await como(A,'salvar_perfil',{codigo:'heranca_teste',nome:'Mesmo perfil',ativo:true,capacidades:[{modulo:'avcb',acao:'consultar'}]})).perfil;
   const vinculos=[];
   for(const id of [B,D]){const a=(await como(A,'salvar_atribuicao',{usuarioId:id,perfilId:p.id,ativo:true,inicio:null,fim:null,herdarPerfil:true})).atribuicao;
    assert.equal(a.herdar_perfil,true);assert.deepEqual(a.abrangencias,[]);vinculos.push(a);
    assert.equal(abasDoContexto(await contexto(id)).avcb,true);assert.equal(abasDoContexto(await contexto(id)).inspecoes,false);
   }
   const audit=(await db.query("select autor_id,depois from portal_acesso.auditoria where entidade='portal_acesso.atribuicoes' and depois->>'id'=$1",[vinculos[0].id])).rows[0];
   assert.equal(audit.autor_id,A);assert.equal(audit.depois.herdar_perfil,true);
   p=await edit(p,[{modulo:'inspecoes',acao:'consultar'}]);
   for(const id of [B,D]){const abas=abasDoContexto(await contexto(id));assert.equal(abas.inspecoes,true);assert.equal(abas.avcb,false);}
   const versaoAntiga=vinculos[0].versao;
   await rejeita(como(A,'salvar_atribuicao',{id:vinculos[0].id,usuarioId:B,perfilId:p.id,ativo:true,inicio:null,fim:null,herdarPerfil:true,versao:versaoAntiga}),'PT409');
   const antes=await auditorias();
   for(const dados of [{herdarPerfil:false},{herdarPerfil:null},{herdarPerfil:true,abrangencias:[]}])
    await rejeita(como(A,'salvar_atribuicao',{usuarioId:B,perfilId:p.id,ativo:true,inicio:null,fim:null,...dados}),'PT400');
   await rejeita(como(B,'salvar_atribuicao',{usuarioId:B,perfilId:P,ativo:true,inicio:null,fim:null,herdarPerfil:true}),'42501');
   assert.equal(await auditorias(),antes);
   p=await edit(p,[{modulo:'inspecoes',acao:'consultar'}],false);
   assert.equal(abasDoContexto(await contexto(B)).inspecoes,false);
   p=await edit(p,[{modulo:'inspecoes',acao:'consultar'}]);
   let a=(await atribuicoes(B)).find(x=>x.id===vinculos[0].id);
   await como(A,'estado_atribuicao',{id:a.id,ativo:false,versao:a.versao});assert.equal(abasDoContexto(await contexto(B)).inspecoes,false);
   assert.equal(abasDoContexto(await contexto(D)).inspecoes,true);
   a=(await atribuicoes(B)).find(x=>x.id===a.id);
   await como(A,'salvar_atribuicao',{id:a.id,usuarioId:B,perfilId:p.id,ativo:true,inicio:null,fim:'2020-01-01T00:00:00.000Z',herdarPerfil:true,versao:a.versao});
   assert.equal(abasDoContexto(await contexto(B)).inspecoes,false);
   a=(await atribuicoes(B)).find(x=>x.id===a.id);
   await rejeita(como(A,'salvar_atribuicao',{id:a.id,usuarioId:B,perfilId:p.id,ativo:true,inicio:null,fim:null,abrangencias:[{modulo:'inspecoes',acao:'consultar',tipo:'corporativa',unidades:[]}],versao:a.versao}),'PT409');
   await como(A,'salvar_atribuicao',{id:a.id,usuarioId:B,perfilId:p.id,ativo:true,inicio:null,fim:null,herdarPerfil:true,versao:a.versao});
   const u=await usuario(B);await como(A,'salvar_usuario',{id:B,ativo:false,versao:u.versao});assert.equal(abasDoContexto(await contexto(B)).inspecoes,false);
   const u2=await usuario(B);await como(A,'salvar_usuario',{id:B,ativo:true,versao:u2.versao});
   assert.equal(abasDoContexto(await contexto(B)).inspecoes,true);
  });
  await t.test("heranca de gestao preserva autorizacao e protecao do ultimo administrador",async()=>{
   const anterior=(await atribuicoes(C)).find(x=>x.perfil_id===P);
   const a=(await como(A,'salvar_atribuicao',{id:anterior.id,versao:anterior.versao,usuarioId:C,perfilId:P,ativo:true,inicio:null,fim:null,herdarPerfil:true})).atribuicao;
   assert.equal((await como(C,'listar_usuarios',{limite:100})).total,4);
   let u=await usuario(A);await como(C,'salvar_usuario',{id:A,ativo:false,versao:u.versao});
   const p=await perfil(P,C);
   await rejeita(como(C,'salvar_perfil',{id:P,codigo:p.codigo,nome:p.nome,ativo:true,capacidades:capacidades.slice(0,2),versao:p.versao}),'PT409');
   const atual=(await atribuicoes(C,C)).find(x=>x.id===a.id);
   await rejeita(como(C,'estado_atribuicao',{id:atual.id,ativo:false,versao:atual.versao}),'PT409');
   u=await usuario(A,C);await como(C,'salvar_usuario',{id:A,ativo:true,versao:u.versao});
   await como(A,'estado_atribuicao',{id:atual.id,ativo:false,versao:atual.versao});
  });
  await t.test("perfil aceita as 19 abas e rejeita capacidade desconhecida",async()=>{
   const {MODULOS_CONSULTA,abasDoContexto,ABAS_POR_ROTA,rotaPermitida}=await import("../src/lib/auth/acessoAbas.ts");
   const capacidades=[...MODULOS_CONSULTA.map(modulo=>({modulo,acao:"consultar"})),...["usuarios","permissoes","solicitacoes_acesso"].map(modulo=>({modulo,acao:"gerenciar"}))];
   const p=(await como(A,"salvar_perfil",{codigo:"todas_abas",nome:"Todas as abas",ativo:true,capacidades})).perfil;
   assert.equal(p.capacidades.length,19);
   await como(A,"salvar_atribuicao",{usuarioId:B,perfilId:p.id,ativo:true,inicio:null,fim:null,herdarPerfil:true});
   await db.query("select set_config('request.jwt.claim.sub',$1,false)",[B]);
   const abas=abasDoContexto((await db.query("select public.obter_contexto_acesso_portal() as valor")).rows[0].valor);
   await db.query("select set_config('request.jwt.claim.sub','',false)");
   for(const rota of Object.keys(ABAS_POR_ROTA))assert.equal(rotaPermitida(rota,abas),true,rota);
   await rejeita(como(A,"salvar_perfil",{codigo:"aba_invalida",nome:"Inválido",ativo:true,capacidades:[{modulo:"inexistente",acao:"consultar"}]}),"PT400");
   const a=(await atribuicoes(B)).find(a=>a.perfil_id===p.id);
   await como(A,"estado_atribuicao",{id:a.id,versao:a.versao,ativo:false});
  });
  await t.test("exclusao exige perfil vazio; transferencia preserva vinculos e historico",async()=>{
   const criar=async(codigo,nome)=>(await como(A,"salvar_perfil",{codigo,nome,ativo:true,capacidades:[{modulo:"avcb",acao:"consultar"}]})).perfil;
   let origem=await criar("excluir_origem","Origem"),destino=await criar("excluir_destino","Destino");
   const obter=async id=>(await como(A,"obter_perfil",{id})).perfil;
   const antes=await auditorias();
   await rejeita(como(B,"excluir_perfil",{id:origem.id,versao:origem.versao}),"42501");
   await rejeita(como(null,"obter_perfil",{id:origem.id}),"42501");
   await rejeita(como(A,"excluir_perfil",{id:origem.id,versao:"antiga"}),"PT409");
   assert.equal(await auditorias(),antes);
   const vinculos=[];
   for(const usuarioId of [B,D]) {
    const a=(await como(A,"salvar_atribuicao",{usuarioId,perfilId:origem.id,ativo:usuarioId===B,
     inicio:null,fim:usuarioId===D?"2020-01-01T00:00:00.000Z":null,herdarPerfil:true})).atribuicao;
    vinculos.push(a);
   }
   assert.equal((await obter(origem.id)).usuarios_vinculados,2);
   await assert.rejects(como(A,"excluir_perfil",{id:origem.id,versao:origem.versao}),e=>e.code==="PT409"&&/Atribua outro perfil/.test(e.message));
   async function transferir(a,perfilId=destino.id) {
    return como(A,"salvar_atribuicao",{id:a.id,versao:a.versao,usuarioId:a.user_id,perfilId,ativo:a.ativo,
     inicio:a.inicio?new Date(a.inicio).toISOString():null,fim:a.fim?new Date(a.fim).toISOString():null,herdarPerfil:true});
   }
   const movido=(await transferir(vinculos[0])).atribuicao;
   assert.equal(movido.id,vinculos[0].id);assert.equal(movido.perfil_id,destino.id);assert.deepEqual(movido.abrangencias,[]);
   await rejeita(transferir(vinculos[0]),"PT409");
   origem=await obter(origem.id);
   assert.equal(origem.usuarios_vinculados,1);
   await rejeita(como(A,"excluir_perfil",{id:origem.id,versao:origem.versao}),"PT409");
   const movidoD=(await transferir(vinculos[1])).atribuicao;
   assert.equal(movidoD.ativo,false);assert.equal(movidoD.fim,vinculos[1].fim);
   const antigo=(await atribuicoes(B)).find(a=>a.id===atribuicao.id);
   await rejeita(transferir(antigo),"PT409"); // usuário já possui o perfil de destino
   const legado=(await transferir(antigo,origem.id)).atribuicao;
   assert.equal(legado.herdar_perfil,true);assert.deepEqual(legado.abrangencias,[]);
   const terceira=await criar("excluir_terceira","Terceira");
   await transferir(legado,terceira.id);
   origem=await obter(origem.id);assert.equal(origem.usuarios_vinculados,0);
   const historicoAntes=(await db.query("select id,antes,depois from portal_acesso.auditoria where entidade='portal_acesso.perfis' and depois->>'id'=$1",[origem.id])).rows;
   await como(A,"excluir_perfil",{id:origem.id,versao:origem.versao});
   await rejeita(como(A,"obter_perfil",{id:origem.id}),"PT404");
   await rejeita(como(A,"excluir_perfil",{id:origem.id,versao:origem.versao}),"PT404");
   assert.deepEqual((await db.query("select id,antes,depois from portal_acesso.auditoria where entidade='portal_acesso.perfis' and depois->>'id'=$1",[origem.id])).rows,historicoAntes);
   const removido=(await db.query("select autor_id,antes from portal_acesso.auditoria where entidade='portal_acesso.perfis' and operacao='DELETE' and antes->>'id'=$1",[origem.id])).rows[0];
   assert.equal(removido.autor_id,A);assert.equal(removido.antes.nome,"Origem");
   const historico=(await como(A,"listar_auditoria",{limite:100})).dados;
   assert.equal(historico.some(a=>a.perfil_atual_id===origem.id),false);
   assert.ok(historico.some(a=>a.perfil_atual_id===destino.id));
   const admin=(await atribuicoes(A)).find(a=>a.perfil_id===P);
   await rejeita(transferir(admin,terceira.id),"PT409");
   assert.equal((await atribuicoes(A)).find(a=>a.id===admin.id).perfil_id,P);
  });
  await t.test("trava tambem cobre escrita direta, sem expor tabelas aos clientes",async()=>{
   await db.exec("begin");
   await db.query("update public.perfis_portal set ativo=false where user_id=$1",[A]);
   await rejeita(db.exec("commit"),"PT409");await db.exec("rollback");
   const u=await usuario(A);assert.equal(u.ativo,true);
   const r=await como(A,"listar_auditoria",{limite:100});assert.ok(r.total>0);
  });
 } finally {await db.close();}
});

test("migration de gestao exige bootstrap permanente previo e reverte sem criar auxiliares",async()=>{
 const db=new PGlite();
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
   create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,
     banned_until timestamptz,deleted_at timestamptz,is_anonymous boolean default false);
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;`);
  await db.exec(await migration("_preparar_gestao_acesso_portal.sql"));
  await db.exec(await migration("_criar_permissionamento_portal.sql"));
  await assert.rejects(db.exec(await migration("_integrar_gestao_acessos_portal.sql")),e=>e.code==="PT409");
  await db.exec("rollback");
  const r=await db.query("select to_regprocedure('portal_acesso.tem_gestao(uuid,text,boolean)') as funcao");
  assert.equal(r.rows[0].funcao,null);
 }finally{await db.close();}
});
