import assert from "node:assert/strict";
import test from "node:test";
import { readFile,readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const A="00000000-0000-4000-8000-000000000001",U="00000000-0000-4000-8000-000000000002",D="00000000-0000-4000-8000-000000000003";
const P="10000000-0000-4000-8000-000000000001",T="10000000-0000-4000-8000-000000000002";
async function migration(nome){const dir=new URL("../../supabase/migrations/",import.meta.url);const f=(await readdir(dir)).find(n=>n.endsWith("_"+nome+".sql"));return readFile(new URL(f,dir),"utf8");}
test("aprovação transacional com perfil e convite: autorização, identidade, validade, reenvio e auditoria",async t=>{
 const db=new PGlite();
 async function como(ator,op,dados){await db.exec("begin");try{await db.query("select set_config('request.jwt.claim.sub',$1,true)",[ator]);await db.exec("set local role authenticated");const r=await db.query("select public.gerir_acessos_portal($1,$2::jsonb) valor",[op,JSON.stringify(dados)]);await db.exec("commit");return r.rows[0].valor;}catch(e){await db.exec("rollback");throw e;}}
 const rejeita=(p,code)=>assert.rejects(p,e=>e.code===code);
 try{
  await db.exec("create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,banned_until timestamptz,deleted_at timestamptz,is_anonymous boolean default false);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,anon,service_role;grant execute on function auth.uid() to authenticated,anon,service_role;");
  await db.exec(await migration("preparar_gestao_acesso_portal"));await db.exec(await migration("criar_permissionamento_portal"));
  for(const [id,email,confirmado] of [[A,"admin@exemplo.test",true],[U,"pessoa@exemplo.test",false],[D,"analista@exemplo.test",true]])await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,$2,case when $3 then now() end)",[id,email,confirmado]);
  await db.query("insert into public.perfis_portal(user_id,papel) values($1,'ADMIN_SSO')",[A]);
  await db.query("insert into portal_acesso.perfis(id,codigo,nome) values($1,'admin_teste','Administrador'),($2,'tst','TST')",[P,T]);
  await db.query("insert into portal_acesso.permissoes_perfil(perfil_id,modulo,acao) select $1,m,'gerenciar' from unnest(array['usuarios','permissoes','solicitacoes_acesso']) m",[P]);
  await db.query("insert into portal_acesso.permissoes_perfil(perfil_id,modulo,acao) values($1,'inspecoes','consultar')",[T]);
  const x=(await db.query("insert into portal_acesso.atribuicoes(user_id,perfil_id) values($1,$2) returning id",[A,P])).rows[0].id;
  await db.query("insert into portal_acesso.abrangencias(atribuicao_id,perfil_id,modulo,acao,tipo) select $1,$2,m,'gerenciar','corporativa' from unnest(array['usuarios','permissoes','solicitacoes_acesso']) m",[x,P]);
  for(const m of ["integrar_gestao_acessos_portal","herdar_permissoes_do_perfil","gerir_exclusao_perfis","aprovar_solicitacao_com_perfil_convite"])await db.exec(await migration(m));
  const s=(await db.query("insert into public.solicitacoes_acesso(nome_completo,email_corporativo,empresa,cargo_funcao,projeto_unidade,justificativa,status) values('Pessoa','pessoa@exemplo.test','Empresa','TST','Unidade','Acesso','APROVADO') returning to_jsonb(solicitacoes_acesso.*) s")).rows[0].s;
  const dados={id:s.id,acao:"APROVAR",perfilId:T,semVencimento:true,fim:null,versao:s.atualizado_em,observacao:"Validado"};
  await t.test("aprovação antiga pode ser concluída mas chamada legada sem perfil não libera acesso",async()=>{
   await rejeita(como(A,"analisar_solicitacao",{id:s.id,acao:"APROVAR"}),"PT409");
   await rejeita(como(A,"preparar_aprovacao",{...dados,perfilId:null}),"PT400");
   await rejeita(como(D,"preparar_aprovacao",dados),"42501");
   assert.equal(Number((await db.query("select count(*) n from portal_acesso.atribuicoes where user_id=$1",[U])).rows[0].n),0);
  });
  await t.test("validade, perfil ativo e destinatário são verificados no banco",async()=>{
   await rejeita(como(A,"preparar_aprovacao",{...dados,semVencimento:false}),"PT400");
   await rejeita(como(A,"preparar_aprovacao",{...dados,semVencimento:false,fim:"2020-01-01T00:00:00Z"}),"PT400");
   await rejeita(como(A,"preparar_aprovacao",{...dados,email:"forjado@exemplo.test"}),"PT400");
   const r=await como(A,"preparar_aprovacao",dados);assert.equal(r.solicitacao.email,"pessoa@exemplo.test");assert.equal(r.conta.confirmado,false);
   await rejeita(como(A,"analisar_solicitacao",{...dados,usuarioId:D}),"PT409");
  });
  await t.test("a conta é vinculada ao perfil escolhido sem confirmar o e-mail por conta própria",async()=>{
   const r=await como(A,"analisar_solicitacao",{...dados,usuarioId:U});
   assert.equal(r.solicitacao.status,"APROVADO");assert.equal(r.solicitacao.perfil_liberado_nome,"TST");assert.ok(r.solicitacao.liberado_em);
   const vinculo=(await db.query("select perfil_id,ativo,herdar_perfil from portal_acesso.atribuicoes where user_id=$1",[U])).rows[0];assert.deepEqual(vinculo,{perfil_id:T,ativo:true,herdar_perfil:true});
   assert.equal((await db.query("select email_confirmed_at from auth.users where id=$1",[U])).rows[0].email_confirmed_at,null);
   await rejeita(como(A,"analisar_solicitacao",{...dados,usuarioId:U}),"PT409");
  });
  await t.test("reenvio é limitado e resultado pertence à tentativa atual",async()=>{
   const envio=await como(A,"preparar_convite",{id:s.id});
   assert.equal(envio.solicitacao.convite_status,"PROCESSANDO");
   await rejeita(como(A,"preparar_convite",{id:s.id}),"PT409");
   await rejeita(como(A,"registrar_convite",{id:s.id,tentativaId:P,status:"ENVIADO"}),"PT409");
   const falhou=await como(A,"registrar_convite",{id:s.id,tentativaId:envio.solicitacao.convite_tentativa_id,status:"FALHOU"});assert.equal(falhou.solicitacao.convite_status,"FALHOU");
   await db.query("update public.solicitacoes_acesso set convite_tentativa_em=now()-interval '61 seconds' where id=$1",[s.id]);
   const novo=await como(A,"preparar_convite",{id:s.id});
   const enviado=await como(A,"registrar_convite",{id:s.id,tentativaId:novo.solicitacao.convite_tentativa_id,status:"ENVIADO"});assert.equal(enviado.solicitacao.convite_status,"ENVIADO");assert.ok(enviado.solicitacao.convite_enviado_em);
  });
  await t.test("bloqueio posterior impede novo convite e não reativa o cadastro",async()=>{
   await db.query("update public.perfis_portal set ativo=false where user_id=$1",[U]);
   await rejeita(como(A,"preparar_convite",{id:s.id}),"PT409");
   assert.ok(Number((await db.query("select count(*) n from portal_acesso.auditoria where entidade='public.solicitacoes_acesso'")).rows[0].n)>=5);
   const acl=await db.query("select has_function_privilege('anon','portal_acesso.liberar_solicitacao(text,jsonb)','execute') anon,has_function_privilege('authenticated','portal_acesso.liberar_solicitacao(text,jsonb)','execute') autenticado");
   assert.deepEqual(acl.rows[0],{anon:false,autenticado:false});
  });
 }finally{await db.close();}
});
