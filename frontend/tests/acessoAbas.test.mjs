import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync,existsSync} from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {abasDoContexto,rotaPermitida,exigirAba,MODULOS_CONSULTA} from '../src/lib/auth/acessoAbas.ts';
const req=createRequire(new URL('../package.json',import.meta.url));
const ts=req('typescript'),React=req('react');
const {renderToStaticMarkup}=req('react-dom/server');
const raiz=fileURLToPath(new URL('../src/',import.meta.url));
function contexto(modulos=[],abrangencia={tipo:'corporativa'}){return {usuarioId:'pessoa',ativo:true,perfis:[{perfil:'perfil_reutilizavel',ativo:true,concessoes:modulos.map(modulo=>({modulo,acoes:[MODULOS_CONSULTA.includes(modulo)?'consultar':'gerenciar'],abrangencia}))}]};}
function sessao(estado){return {auth:{async getUser(){return {data:{user:estado.logado===false?null:{id:'pessoa'}},error:null};}},async rpc(nome){assert.equal(nome,'obter_contexto_acesso_portal');return {data:estado.contexto,error:estado.falha?{message:'interno'}:null};}};}
function ambiente(estado){
 const cache=new Map();
 const dados={from(){return dados;},select(){return dados;},eq(){return dados;},gte(){return dados;},lt(){return dados;},ilike(){return dados;},in(){return dados;},order(){return dados;},range(){return dados;},limit(){return dados;},then(resolve,reject){return Promise.resolve({data:[],error:null,count:0}).then(resolve,reject);}};
 function carregar(arquivo){
  arquivo=path.resolve(arquivo);if(cache.has(arquivo))return cache.get(arquivo);
  const fonte=readFileSync(arquivo,'utf8');
  const codigo=ts.transpileModule(fonte,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
  const modulo={exports:{}};cache.set(arquivo,modulo.exports);
  const importar=pedido=>{
   if(pedido==='@supabase/supabase-js')return {createClient(){estado.consultasPrivilegiadas=(estado.consultasPrivilegiadas??0)+1;return dados;}};
   if(pedido==='next/navigation')return {redirect(url){throw Error('REDIRECT:'+url);}};
   if(pedido==='next/dynamic')return {__esModule:true,default:()=>()=>null};
   const resolvido=pedido.startsWith('@/')?path.join(raiz,pedido.slice(2)):pedido.startsWith('.')?path.resolve(path.dirname(arquivo),pedido):null;
   if(resolvido){
    const semExt=resolvido.replace(/\.tsx?$/,'');
    if(semExt===path.join(raiz,'lib/supabase/server'))return {createClient:async()=>sessao(estado)};
    if(/(HistoricoMotoristas|DirecaoMotoristas|VelocidadeMotoristas)$/.test(semExt))return {__esModule:true,default:()=>React.createElement('div',null,path.basename(semExt))};
    const alvo=[resolvido,resolvido+'.ts',resolvido+'.tsx'].find(f=>existsSync(f));if(!alvo)throw Error(pedido);return carregar(alvo);
   }
   return req(pedido);
  };
  new Function('require','module','exports',codigo)(importar,modulo,modulo.exports);cache.set(arquivo,modulo.exports);return modulo.exports;
 }
 return arquivo=>carregar(path.join(raiz,arquivo));
}
const rotas=[['avcb','avcb'],['inspecoes','inspecoes'],['planos-acao','planos_acao'],['acoes-corretivas','acoes_corretivas'],['motoristas','motoristas'],['motoristas/historico','motoristas_historico'],['motoristas/direcao','motoristas_direcao'],['motoristas/velocidade','motoristas_velocidade']];
test('abas: perfil reutilizavel concede somente capacidades e nao depende do nome',()=>{
 const c=contexto(['inspecoes']);for(const id of ['pessoa1','pessoa2']){const r=abasDoContexto({...c,usuarioId:id});assert.equal(r.inspecoes,true);assert.equal(r.motoristas,false);assert.equal(r.usuarios,false);}
 assert.equal(rotaPermitida('/consultas/painel-gerencial/inspecoes',abasDoContexto(c)),true);
 assert.equal(rotaPermitida('/consultas/painel-gerencial/motoristas',abasDoContexto(c)),false);
 assert.equal(rotaPermitida('/gestao/configuracoes',abasDoContexto(c)),false);
 assert.equal(abasDoContexto(contexto(['motoristas'],{tipo:'restrita',unidades:[{coligada:'1'}]})).motoristas,false);
});
test('abas: revogacao, inativacao, vencimento e falha sao observados sem novo login',async()=>{
 const estado={contexto:contexto(['inspecoes'])};const cliente=sessao(estado);
 assert.equal((await exigirAba(cliente,'inspecoes')).ok,true);
 estado.contexto.perfis[0].ativo=false;assert.equal((await exigirAba(cliente,'inspecoes')).status,403);
 estado.contexto=contexto(['inspecoes']);estado.contexto.perfis[0].fim='2020-01-01T00:00:00Z';assert.equal((await exigirAba(cliente,'inspecoes')).status,403);
 estado.contexto=contexto(['inspecoes']);estado.contexto.ativo=false;assert.equal((await exigirAba(cliente,'inspecoes')).status,403);
 estado.falha=true;assert.equal((await exigirAba(cliente,'inspecoes')).status,503);
 estado.logado=false;assert.equal((await exigirAba(cliente,'inspecoes')).status,401);
});
test('oito APIs reais: sessao ausente e perfil de outro modulo nao chegam ao cliente privilegiado',async t=>{
 const anterior=process.env.NODE_ENV;process.env.NODE_ENV='development';
 try{for(const [rota,modulo] of rotas)await t.test(rota,async()=>{
  for(const logado of [false,true]){
   const estado={logado,contexto:contexto(['usuarios']),consultasPrivilegiadas:0};
   const {GET}=ambiente(estado)('app/api/'+rota+'/route.ts');const {NextRequest}=req('next/server');
   const r=await GET(new NextRequest('http://portal.test/api/'+rota));
   assert.equal(r.status,logado?403:401);assert.equal(estado.consultasPrivilegiadas,0);assert.match(r.headers.get('cache-control'),/private.*no-store/);
  }
 });}finally{process.env.NODE_ENV=anterior;}
});
test('oito APIs reais: somente a aba concedida libera a consulta; as outras continuam bloqueadas',async t=>{
 const anterior={...process.env};process.env.NODE_ENV='development';process.env.SUPABASE_URL='https://hml.example.test';process.env.NEXT_PUBLIC_SUPABASE_URL=process.env.SUPABASE_URL;process.env.SUPABASE_SECRET_KEY='fixture_local_sem_credencial_real';
 try{for(const [rota,modulo] of rotas)await t.test(rota,async()=>{
  const estado={contexto:contexto([modulo]),consultasPrivilegiadas:0};const carregar=ambiente(estado);const {GET}=carregar('app/api/'+rota+'/route.ts');const {NextRequest}=req('next/server');
  assert.equal((await GET(new NextRequest('http://portal.test/api/'+rota))).status,200);assert.ok(estado.consultasPrivilegiadas>0);
  const antes=estado.consultasPrivilegiadas;estado.contexto=contexto([]);
  assert.equal((await GET(new NextRequest('http://portal.test/api/'+rota))).status,403);assert.equal(estado.consultasPrivilegiadas,antes);
 });}finally{for(const k of ['NODE_ENV','SUPABASE_URL','NEXT_PUBLIC_SUPABASE_URL','SUPABASE_SECRET_KEY']){if(anterior[k]===undefined)delete process.env[k];else process.env[k]=anterior[k];}}
});
test('paginas diretas negam acesso antes de renderizar os paineis',async()=>{
 const estado={contexto:contexto(['inspecoes'])};const Protecao=ambiente(estado)('components/auth/ProtecaoAbas.tsx').default;
 for(const [rota,modulos] of Object.entries((await import('../src/lib/auth/acessoAbas.ts')).ABAS_POR_ROTA)){
  const r=await Protecao({modulos,children:()=>React.createElement('p',null,'CONTEUDO_PERMITIDO')});
  const html=renderToStaticMarkup(r);assert.equal(html.includes('CONTEUDO_PERMITIDO'),rota.endsWith('/inspecoes'));
 }
});
test('abas independentes: Acao Corretiva e Historico nao exigem consulta de Planos ou Motoristas',()=>{
 const estado={contexto:contexto([])};const carregar=ambiente(estado);
 const Acoes=carregar('app/(admin)/consultas/painel-gerencial/planos-acao/PainelAcoes.tsx').default;
 const a=renderToStaticMarkup(React.createElement(Acoes,{abas:{acoes_corretivas:true}}));
 assert.match(a,/Ação Corretiva/);assert.doesNotMatch(a,/>Plano de Ação<|Carregando Planos de Ação/);
 const Moto=carregar('app/(admin)/consultas/painel-gerencial/motoristas/PainelMotoristas.tsx').default;
 const m=renderToStaticMarkup(React.createElement(Moto,{abas:{motoristas_historico:true}}));assert.match(m,/HistoricoMotoristas/);assert.doesNotMatch(m,/>Resumo<|>Cadastro e Identificação<|>Velocidade<|>Direção contínua</);
});
test('permissoes nao liberam recursos em validacao e configuracao de outro projeto falha fechada',async()=>{
 const anterior={...process.env};process.env.NODE_ENV='production';delete process.env.SSO_MOTORISTAS_HISTORICO_ENABLED;delete process.env.SSO_MOTORISTAS_DIRECAO_ENABLED;delete process.env.SSO_MOTORISTAS_APIS_ENABLED;
 try{
  const servidor=ambiente({contexto:contexto(MODULOS_CONSULTA)})('lib/auth/abasServidor.ts');const r=await servidor.carregarAbas();assert.equal(r.ok,true);assert.equal(r.abas.motoristas,true);assert.equal(r.abas.motoristas_historico,false);assert.equal(r.abas.motoristas_direcao,false);assert.equal(r.abas.motoristas_velocidade,false);
  process.env.SUPABASE_URL='https://outro.example.test';process.env.NEXT_PUBLIC_SUPABASE_URL='https://hml.example.test';assert.equal((await servidor.autorizarConsulta('avcb')).status,503);
 }finally{for(const k of ['NODE_ENV','SSO_MOTORISTAS_HISTORICO_ENABLED','SSO_MOTORISTAS_DIRECAO_ENABLED','SSO_MOTORISTAS_APIS_ENABLED','SUPABASE_URL','NEXT_PUBLIC_SUPABASE_URL']){if(anterior[k]===undefined)delete process.env[k];else process.env[k]=anterior[k];}}
});
