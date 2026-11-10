import assert from "node:assert/strict";
import test from "node:test";
import { analisarSolicitacao } from "../src/lib/gestao/solicitacoes.ts";
const origem="https://portal.exemplo.test";
function ambiente(modulos=["solicitacoes_acesso","usuarios","permissoes"]) {
 const estado={ops:[],criados:[],convites:[],redefinicoes:[],confirmado:false,erroEnvio:false,erroPreparo:null,erroFinal:null};
 const cliente={auth:{getUser:async()=>({data:{user:{id:"gestor"}},error:null})},rpc:async(nome,args)=>{
  if(nome==="obter_contexto_acesso_portal") return {error:null,data:{usuarioId:"gestor",ativo:true,perfis:[{perfil:"gestao",ativo:true,concessoes:modulos.map(modulo=>({modulo,acoes:["gerenciar"],abrangencia:{tipo:"corporativa"}}))}]}};
  estado.ops.push(args);
  if(args.p_operacao==="preparar_aprovacao") return {error:estado.erroPreparo,data:{solicitacao:{id:"s1",email:"destinatario@exemplo.test"},conta:estado.confirmado?{id:"u1",confirmado:true}:null}};
  if(args.p_operacao==="analisar_solicitacao")return {error:estado.erroFinal,data:{ok:true}};
  if(args.p_operacao==="preparar_convite")return {error:null,data:{solicitacao:{id:"s1",email_corporativo:"destinatario@exemplo.test",convite_tentativa_id:"t1"},conta:{id:"u1",confirmado:estado.confirmado}}};
  return {error:null,data:{ok:true,solicitacao:{id:"s1",convite_status:args.p_dados.status}}};
 }};
 const admin={resetPasswordForEmail:async(email,opcoes)=>{estado.redefinicoes.push({email,opcoes});return {error:estado.erroEnvio?{message:"segredo-interno"}:null};},createUser:async d=>{estado.criados.push(d);return {error:null,data:{user:{id:"u1"}}};},
  inviteUserByEmail:async(email,opcoes)=>{estado.convites.push({email,opcoes});return {error:estado.erroEnvio?{message:"segredo-interno"}:null,data:{user:{id:"u1"}}};}};
 function executar(dados,headers={}){return analisarSolicitacao(new Request(origem+"/api/gestao/solicitacoes-acesso/s1",{method:"PATCH",headers:{Origin:origem,"Content-Type":"application/json",...headers},body:JSON.stringify(dados)}),"s1",async()=>cliente,()=>admin,origem);}
 return {estado,executar};
}
test("liberação exige origem e as três capacidades antes de criar conta ou enviar mensagem",async()=>{
 for(const modulos of [["solicitacoes_acesso"],["solicitacoes_acesso","usuarios"],["usuarios","permissoes"]]){
  const a=ambiente(modulos);assert.equal((await a.executar({acao:"APROVAR"})).status,403);assert.equal(a.estado.criados.length,0);assert.equal(a.estado.convites.length,0);
 }
 const a=ambiente();assert.equal((await a.executar({acao:"APROVAR"},{Origin:"https://outro.test"})).status,403);assert.equal(a.estado.ops.length,0);
});
test("conta nova fica não confirmada; perfil é vinculado antes do convite e destinatário vem do banco",async()=>{
 const a=ambiente();const r=await a.executar({acao:"APROVAR",perfilId:"p1",versao:"v1"});
 assert.equal(r.status,200);assert.deepEqual(a.estado.criados,[{email:"destinatario@exemplo.test",email_confirm:false}]);
 assert.equal(a.estado.ops[1].p_operacao,"analisar_solicitacao");assert.equal(a.estado.ops[1].p_dados.usuarioId,"u1");
 assert.deepEqual(a.estado.convites,[{email:"destinatario@exemplo.test",opcoes:{redirectTo:origem+"/aceitar-convite"}}]);
 assert.equal(a.estado.ops.at(-1).p_dados.status,"ENVIADO");assert.equal((await r.json()).conviteEnviado,true);
});
test("falha no perfil ou concorrência não envia convite",async()=>{
 for(const campo of ["erroPreparo","erroFinal"]){
  const a=ambiente();a.estado[campo]={code:"PT409",message:"Atualize a tela."};
  assert.equal((await a.executar({acao:"APROVAR"})).status,409);assert.equal(a.estado.convites.length,0);
  if(campo==="erroPreparo")assert.equal(a.estado.criados.length,0);
 }
});
test("falha de e-mail fica registrada sem expor erros internos nem desfazer o perfil",async()=>{
 const a=ambiente();a.estado.erroEnvio=true;const r=await a.executar({acao:"APROVAR"});assert.equal(r.status,200);
 const corpo=await r.json();assert.equal(corpo.solicitacao.convite_status,"FALHOU");assert.match(corpo.mensagem,/não confirmou o envio/);assert.doesNotMatch(JSON.stringify(corpo),/segredo-interno/);
});
test("conta confirmada usa o login existente sem recriar usuário ou enviar redefinição de senha",async()=>{
 const a=ambiente();a.estado.confirmado=true;const r=await a.executar({acao:"APROVAR"});
 assert.equal(r.status,200);assert.equal(a.estado.criados.length,0);assert.equal(a.estado.convites.length,0);assert.equal(a.estado.ops.at(-1).p_dados.status,"CONTA_EXISTENTE");
});
test("reenvio não altera perfis e não aceita destinatário fornecido pelo cliente",async()=>{
 const a=ambiente();assert.equal((await a.executar({acao:"REENVIAR_CONVITE"})).status,200);
 assert.deepEqual(a.estado.ops.map(o=>o.p_operacao),["preparar_convite","registrar_convite"]);assert.equal(a.estado.criados.length,0);
 const b=ambiente();assert.equal((await b.executar({acao:"REENVIAR_CONVITE",email:"outro@exemplo.test"})).status,400);assert.equal(b.estado.convites.length,0);
});
test("rejeitar continua possível com a capacidade de analisar solicitações e não envia mensagem",async()=>{
 const a=ambiente(["solicitacoes_acesso"]);assert.equal((await a.executar({acao:"REJEITAR",observacao:"Avaliado"})).status,200);assert.equal(a.estado.criados.length,0);assert.equal(a.estado.convites.length,0);
});

test("reenvio para conta confirmada envia link de senha sem recriar conta ou alterar perfil",async()=>{
 const a=ambiente();a.estado.confirmado=true;const r=await a.executar({acao:"REENVIAR_CONVITE"});const corpo=await r.json();
 assert.equal(r.status,200);assert.equal(a.estado.criados.length,0);assert.equal(a.estado.convites.length,0);
 assert.deepEqual(a.estado.redefinicoes,[{email:"destinatario@exemplo.test",opcoes:{redirectTo:origem}}]);
 assert.deepEqual(a.estado.ops.map(o=>o.p_operacao),["preparar_convite","registrar_convite"]);
 assert.equal(corpo.solicitacao.convite_status,"ENVIADO");assert.match(corpo.mensagem,/novo link para definir a senha/);
});
test("falha no envio de link de senha é registrada sem expor detalhes do provedor",async()=>{
 const a=ambiente();a.estado.confirmado=true;a.estado.erroEnvio=true;const r=await a.executar({acao:"REENVIAR_CONVITE"});const corpo=await r.json();
 assert.equal(corpo.solicitacao.convite_status,"FALHOU");assert.equal(corpo.conviteEnviado,false);assert.doesNotMatch(JSON.stringify(corpo),/segredo-interno/);
});
