import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as contratos from "../src/lib/gestao/contratos.ts";
import * as politica from "../src/lib/auth/politicaAcesso.ts";
const raiz=fileURLToPath(new URL("../",import.meta.url));
const requireFrontend=createRequire(new URL("../package.json",import.meta.url));
const React=requireFrontend("react");
const {renderToStaticMarkup}=requireFrontend("react-dom/server");
const ts=requireFrontend("typescript");
function componente(nome,respostas={}){
 const cache=new Map();
 function carregar(arquivo){
  if(cache.has(arquivo))return cache.get(arquivo);
  const fonte=readFileSync(arquivo,"utf8");
  const codigo=ts.transpileModule(fonte,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,
   target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
  const modulo={exports:{}};cache.set(arquivo,modulo.exports);
  const importar=pedido=>{
   if(pedido==="@/lib/gestao/contratos")return contratos;
   if(pedido==="@/lib/auth/politicaAcesso")return politica;
   if(pedido==="@/lib/gestao/cliente")return {salvar:()=>{throw new Error("Renderizacao nao pode alterar dados");}};
   if(pedido.startsWith("./")){
    const r=carregar(path.resolve(path.dirname(arquivo),pedido+".tsx"));
    return pedido==="./GestaoUI"?{...r,useConsulta:url=>({dados:respostas[url]??null,erro:"",carregando:false,atualizar(){}})}:r;
   }
   return requireFrontend(pedido);
  };
  new Function("require","module","exports",codigo)(importar,modulo,modulo.exports);
  cache.set(arquivo,modulo.exports);
  return modulo.exports;
 }
 return carregar(path.join(raiz,"src/components/gestao",nome+".tsx")).default;
}
test("editor nao concede abrangencia corporativa automaticamente",()=>{
 const Editor=componente("EditorAbrangencias");
 const capacidades=[{modulo:"usuarios",acao:"gerenciar",ativo:true},{modulo:"motoristas",acao:"consultar",ativo:true}];
 const html=renderToStaticMarkup(React.createElement(Editor,{capacidades,valor:[],alterar(){}}));
 assert.equal((html.match(/<option value="" selected="">Sem concessão<\/option>/g)??[]).length,2);
 assert.doesNotMatch(html,/<option value="corporativa" selected/);
 assert.doesNotMatch(html,/Somente unidades informadas|<option value="restrita"/);
});
test("edicao restrita preserva coligada e secao como pares separados",()=>{
 const Editor=componente("EditorAbrangencias");
 const html=renderToStaticMarkup(React.createElement(Editor,{capacidades:[{modulo:"motoristas",acao:"consultar",ativo:true}],
  valor:[{modulo:"motoristas",acao:"consultar",tipo:"restrita",unidades:[{coligada:"1",secao_rm:"10"},{coligada:"2",secao_rm:"20"}]}],alterar(){}}));
 assert.match(html,/Restrição anterior \(sem acesso à aba nesta versão\)/);
 assert.match(html,/value="1"/);assert.match(html,/value="10"/);assert.match(html,/value="2"/);assert.match(html,/value="20"/);
 assert.ok(html.indexOf('value="1"')<html.indexOf('value="10"'));
 assert.ok(html.indexOf('value="10"')<html.indexOf('value="2"'));
});
test("nova concessao exige escolha de perfil e vencimento ou opcao permanente explicita",()=>{
 const Editor=componente("EditorConcessao",{"/api/gestao/catalogo-perfis?limite=100&busca=":{dados:[],total:0}});
 const html=renderToStaticMarkup(React.createElement(Editor,{usuario:{usuario_id:"pessoa_teste",email:"pessoa@exemplo.test"},
  concluir(){},cancelar(){}}));
 assert.match(html,/<option value="" selected="">Selecione um perfil/);
 assert.match(html,/type="datetime-local"[^>]*required=""/);
 assert.doesNotMatch(html,/<input type="checkbox" checked=""\/>Sem vencimento/);
 assert.match(html,/As abas permitidas são definidas no perfil/);
 assert.doesNotMatch(html,/Conferência antes de salvar|abrangencia-|Sem concessão/);
});
test("listagem e historico exibem dados humanos sem os detalhes internos brutos",()=>{
 const perfil={id:"perfil1",codigo:"tecnico",nome:"Equipe técnica",descricao:"Consulta restrita",ativo:true,versao:"v1",
  capacidades:[{modulo:"motoristas",acao:"consultar",ativo:true}]};
 const Tela=componente("GestaoPermissoes",{
  "/api/gestao/permissoes?pagina=1&busca=":{dados:[perfil],total:1},
  "/api/gestao/auditoria?pagina=1":{dados:[{id:"auditoria1",entidade:"portal_acesso.perfis",operacao:"UPDATE",
   ocorrido_em:"2026-10-29T19:00:00Z",autor:"gestor@exemplo.test",alvo:null,antes:{nome:"Equipe antiga",ativo:true},
   depois:{nome:"Equipe técnica",ativo:false,atualizado_em:"campo_interno_nao_exibir"}}],total:1},
 });
 const html=renderToStaticMarkup(React.createElement(Tela));
 assert.match(html,/Equipe técnica/);assert.match(html,/gestor@exemplo.test/);assert.match(html,/Estado: inativo/);
 assert.doesNotMatch(html,/campo_interno_nao_exibir/);
 assert.match(html,/Ver registro da alteração/);
});

test("solicitacoes usam pagina e contagens do servidor sem recalcular o total pela pagina",()=>{
 const url="/api/gestao/solicitacoes-acesso?pagina=1&status=PENDENTE&empresa=TODAS&busca=";
 const Tela=componente("GestaoSolicitacoes",{[url]:{
  dados:[{id:"solicitacao_teste",nome_completo:"Pessoa amostra",email_corporativo:"amostra@exemplo.test",
   empresa:"Empresa teste",cargo_funcao:"Cargo teste",projeto_unidade:"Unidade teste",justificativa:"Amostra ficticia",
   status:"PENDENTE",criado_em:"2026-10-29T19:00:00Z",atualizado_em:"2026-10-29T19:00:00Z",
   analisado_em:null,analisado_por:null,observacao_analise:null}],
  total:75,empresas:["Empresa teste"],contagens:{pendentes:37,aprovadas:31,rejeitadas:7,total:75},
 }});
 const html=renderToStaticMarkup(React.createElement(Tela));
 assert.match(html,/Pessoa amostra/);
 assert.match(html,/amostra@exemplo.test/);
 assert.match(html,/>Pendentes<\/p><p[^>]*>37<\/p>/);
 assert.match(html,/75 registro\(s\)/);
 assert.match(html,/Página 1 de 3/);
});

test("vinculo de perfil nao oferece selecao de abas por usuario",()=>{
 const perfil={id:'perfil_teste',codigo:'teste',nome:'Perfil de consulta',ativo:true,capacidades:[{modulo:'avcb',acao:'consultar',ativo:true}],versao:'p1'};
 const Editor=componente('EditorConcessao');
 const html=renderToStaticMarkup(React.createElement(Editor,{usuario:{usuario_id:'pessoa',email:'pessoa@exemplo.test'},inicial:{id:'vinculo',perfil_id:perfil.id,perfil,herdar_perfil:true,ativo:true,inicio:null,fim:null,versao:'v1'},concluir(){},cancelar(){}}));
 assert.equal((html.match(/<select/g)??[]).length,1);
 assert.match(html,/Perfil de consulta/);assert.match(html,/Salvar vínculo/);
 assert.doesNotMatch(html,/abrangencia-|Sem concessão|Conferência antes de salvar|<option value="corporativa"/);
});
