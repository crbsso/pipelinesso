import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
const require=createRequire(new URL("../package.json",import.meta.url)),ts=require("typescript");
const file=new URL("../src/app/(full-width-pages)/(auth)/aceitar-convite/page.tsx",import.meta.url);
function ambiente(href,falha=false){
 const estado={trocas:[],limpezas:[],verificacoes:[],sessao:[],erros:[]};const efeitos=[];let ref;
 const supabase={auth:{verifyOtp:async d=>{estado.verificacoes.push(d);return {error:falha?{}:null,data:{user:{id:"pessoa"}}};},
  setSession:async d=>{estado.sessao.push(d);return {error:falha?{}:null,data:{user:{id:"pessoa"}}};},
  getUser:async()=>({error:falha?{}:null,data:{user:{id:"pessoa"}}})}};
 const window={location:{href},history:{replaceState:(_a,_b,path)=>{estado.limpezas.push(path);window.location.href="https://portal.exemplo.test"+path;}}};
 const importar=p=>p==="react"?{useState:()=>["",v=>estado.erros.push(v)],useEffect:f=>efeitos.push(f),useRef:()=>ref??(ref={current:false})}:p==="next/navigation"?{useRouter:()=>({replace:path=>estado.trocas.push(path)})}:p==="next/link"?{__esModule:true,default:()=>null}:p==="@/lib/supabase/client"?{createClient:()=>{assert.equal(estado.limpezas.length,1);return supabase;}}:require(p);
 const mod={exports:{}};const code=ts.transpileModule(readFileSync(file,"utf8"),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 new Function("require","module","exports","window",code)(importar,mod,mod.exports,window);
 mod.exports.default();return {estado,executar:async()=>{efeitos[0]();efeitos[0]();await new Promise(setImmediate);}};
}
test("convite por fragmento limpa os tokens antes do SDK e valida identidade antes da senha",async()=>{
 const a=ambiente("https://portal.exemplo.test/aceitar-convite#type=invite&access_token=fixture_access&refresh_token=fixture_refresh");await a.executar();
 assert.deepEqual(a.estado.sessao,[{access_token:"fixture_access",refresh_token:"fixture_refresh"}]);assert.deepEqual(a.estado.limpezas,["/aceitar-convite"]);assert.deepEqual(a.estado.trocas,["/atualizar-senha"]);
});
test("template com token hash também valida uma única vez no modo estrito do React",async()=>{
 const a=ambiente("https://portal.exemplo.test/aceitar-convite?type=invite&token_hash=fixture_hash");await a.executar();assert.deepEqual(a.estado.verificacoes,[{type:"invite",token_hash:"fixture_hash"}]);assert.deepEqual(a.estado.trocas,["/atualizar-senha"]);
});
test("convite inválido ou expirado não leva à definição de senha",async()=>{
 for(const url of ["https://portal.exemplo.test/aceitar-convite","https://portal.exemplo.test/aceitar-convite#type=recovery&access_token=x&refresh_token=y"]){
  const a=ambiente(url);await a.executar();assert.equal(a.estado.sessao.length,0);assert.equal(a.estado.trocas.length,0);assert.match(a.estado.erros[0],/inválido ou expirou/);
 }
 const a=ambiente("https://portal.exemplo.test/aceitar-convite?type=invite&token_hash=fixture_expirado",true);await a.executar();assert.equal(a.estado.trocas.length,0);assert.equal(a.estado.erros.length,1);
});
