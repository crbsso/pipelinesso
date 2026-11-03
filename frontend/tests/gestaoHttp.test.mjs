import assert from "node:assert/strict";
import test from "node:test";
import { executarGestao } from "../src/lib/gestao/http.ts";
const url="https://portal.exemplo.test/api/gestao/usuarios";
function ambiente(modulos=["usuarios","permissoes","solicitacoes_acesso"]) {
 const estado={ativo:true,operacoes:[],erro:null,autenticado:true};
 const cliente={auth:{getUser:async()=>({data:{user:estado.autenticado?{id:"gestor"}:null},error:null})},
  rpc:async(nome,args)=>{
   if(nome==="obter_contexto_acesso_portal")return {error:null,data:{usuarioId:"gestor",ativo:true,
    perfis:[{perfil:"gestao",ativo:estado.ativo,concessoes:modulos.map(modulo=>({modulo,acoes:["gerenciar"],abrangencia:{tipo:"corporativa"}}))}]}};
   estado.operacoes.push(args);return {data:{ok:true},error:estado.erro};
  }};
 return {estado,criar:async()=>cliente};
}
const escrita={modulo:"usuarios",operacao:"salvar_usuario",escrita:true};
function request(dados={},headers={},method="POST"){
 return new Request(url,{method,headers:{Origin:new URL(url).origin,"Content-Type":"application/json",...headers},
  ...(method==="GET"?{}:{body:typeof dados==="string"?dados:JSON.stringify(dados)})});
}
test("gestao HTTP rejeita origem ausente, cruzada e fetch cross-site antes de acessar sessao",async()=>{
 for(const headers of [{Origin:"https://outro.test"},{Origin:""},{"Sec-Fetch-Site":"cross-site"}]){
  let chamadas=0;
  const r=await executarGestao(request({},headers),escrita,async()=>{chamadas++;throw new Error("nao chamar");});
  assert.equal(r.status,403);assert.equal(chamadas,0);
 }
});
test("gestao HTTP exige identidade e capacidades atuais em cada chamada",async()=>{
 const a=ambiente();
 a.estado.autenticado=false;
 assert.equal((await executarGestao(request(),escrita,a.criar)).status,401);
 a.estado.autenticado=true;
 assert.equal((await executarGestao(request(),escrita,a.criar)).status,200);
 a.estado.ativo=false;
 assert.equal((await executarGestao(request(),escrita,a.criar)).status,403);
 assert.equal(a.estado.operacoes.length,1);
});
test("alterar concessao exige as duas capacidades administrativas",async()=>{
 const a=ambiente(["usuarios"]);
 const r=await executarGestao(request(),{...escrita,operacao:"salvar_atribuicao",duplaPermissao:true},a.criar);
 assert.equal(r.status,403);assert.equal(a.estado.operacoes.length,0);
});
test("corpo limitado, formato e identificador divergente sao rejeitados sem mutacao",async()=>{
 for(const [body,headers,status] of [["x".repeat(65537),{},413],["[]",{},400],["{",{},400],["{}",{"Content-Type":"text/plain"},415]]){
  const a=ambiente();const r=await executarGestao(request(body,headers),escrita,a.criar);
  assert.equal(r.status,status);assert.equal(a.estado.operacoes.length,0);
 }
 const a=ambiente();
 assert.equal((await executarGestao(request({id:"outro"}),{...escrita,fixos:{id:"alvo"}},a.criar)).status,400);
});
test("operacao e ator nao sao escolhidos pelo corpo; retorno e privado",async()=>{
 const a=ambiente();
 const r=await executarGestao(request({p_operacao:"listar_usuarios",ator_id:"forjado"}),escrita,a.criar);
 assert.equal(r.status,200);
 assert.equal(a.estado.operacoes[0].p_operacao,"salvar_usuario");
 assert.equal(a.estado.operacoes[0].p_dados.ator_id,"forjado"); // A RPC rejeita chaves desconhecidas; nunca usa como ator.
 assert.match(r.headers.get("cache-control"),/no-store/);
 assert.equal(r.headers.get("vary"),"Cookie");
});
test("erros internos nao sao expostos; erros de conflito controlados preservam estado",async()=>{
 const a=ambiente();a.estado.erro={code:"XX000",message:"detalhe interno sensivel"};
 const r=await executarGestao(request(),escrita,a.criar);
 assert.equal(r.status,503);assert.equal((await r.text()).includes("sensivel"),false);
 a.estado.erro={code:"PT409",message:"O cadastro mudou. Atualize a tela."};
 const conflito=await executarGestao(request(),escrita,a.criar);
 assert.equal(conflito.status,409);assert.equal((await conflito.json()).error,a.estado.erro.message);
});
test("filtros GET sao tipados e limitados sem expor outras operacoes",async()=>{
 const a=ambiente();
 const r=await executarGestao(new Request(url+"?pagina=2&limite=25&busca=teste"),{modulo:"usuarios",operacao:"listar_usuarios"},a.criar);
 assert.equal(r.status,200);assert.deepEqual(a.estado.operacoes[0].p_dados,{pagina:2,limite:25,busca:"teste"});
 assert.equal((await executarGestao(new Request(url+"?pagina=1&pagina=2"),{modulo:"usuarios",operacao:"listar_usuarios"},a.criar)).status,400);
});


test("origem configurada no servidor preserva escrita legitima com URL interna diferente",async()=>{
 for(const origem of ["http://127.0.0.1:3001","https://portal.exemplo.test"]){
  const a=ambiente();
  const req=new Request("http://localhost:3001/api/gestao/usuarios",{method:"POST",headers:{Origin:origem,"Content-Type":"application/json","Sec-Fetch-Site":"same-origin"},body:"{}"});
  assert.equal((await executarGestao(req,escrita,a.criar,origem)).status,200);
  assert.equal(a.estado.operacoes.length,1);
 }
});
test("origem configurada nao aceita aliases, outras portas, protocolos ou cabecalhos forjados",async()=>{
 const destino="http://127.0.0.1:3001";
 for(const headers of [{Origin:"http://localhost:3001"},{Origin:"http://127.0.0.1:3002"},{Origin:"https://127.0.0.1:3001"},{Origin:"http://127.0.0.1:3001.evil.test"},{Origin:"null"},{Origin:""},{Origin:destino,"Sec-Fetch-Site":"cross-site"},{Origin:destino,"Sec-Fetch-Site":"same-site"},{Origin:"https://evil.test",Host:"evil.test","X-Forwarded-Host":"evil.test","X-Forwarded-Proto":"https"}]){
  const req=new Request("http://localhost:3001/api/gestao/usuarios",{method:"POST",headers:{"Content-Type":"application/json",...headers},body:"{}"});let chamadas=0;
  assert.equal((await executarGestao(req,escrita,async()=>{chamadas++;throw Error("nao chamar");},destino)).status,403);
  assert.equal(chamadas,0);
 }
});
test("configuracao invalida de origem falha fechada antes de acessar sessao",async()=>{
 for(const origem of ["", "null", "portal.exemplo.test", "file:///tmp", "https://portal.exemplo.test/caminho", "https://gestor@portal.exemplo.test", "https://portal.exemplo.test?x=1", "https://portal.exemplo.test#x", "https://portal.exemplo.test,https://evil.test"]){
  let chamadas=0;
  const r=await executarGestao(request(),escrita,async()=>{chamadas++;throw Error("nao chamar");},origem);
  assert.equal(r.status,503);assert.equal(chamadas,0);
 }
});
