import assert from 'node:assert/strict';
import {createServerClient} from '@supabase/ssr';
import {createServer} from 'node:http';
import {createHmac} from 'node:crypto';
import {spawn,execFile} from 'node:child_process';
import {once} from 'node:events';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
const user={id:'00000000-0000-4000-8000-000000000040',aud:'authenticated',role:'authenticated',email:'convite@example.test',email_confirmed_at:new Date().toISOString(),created_at:new Date().toISOString(),app_metadata:{provider:'email',providers:['email']},user_metadata:{},identities:[]};
const oldUser={...user,id:"00000000-0000-4000-8000-000000000041",email:"sessao-anterior@example.test"};
function jwt(subject=user){const enc=x=>Buffer.from(JSON.stringify(x)).toString('base64url'),now=Math.floor(Date.now()/1000),s=enc({alg:'HS256',typ:'JWT'})+'.'+enc({sub:subject.id,aud:'authenticated',role:'authenticated',email:subject.email,iat:now,exp:now+3600});return s+'.'+createHmac('sha256','fixture-convite-local').update(s).digest('base64url');}
let appOrigin,child,output='',verifyCalls=0;const consumed=new Set();
const auth=createServer(async(req,res)=>{
 res.setHeader('Access-Control-Allow-Origin',appOrigin||'*');res.setHeader('Access-Control-Allow-Headers','authorization,apikey,x-client-info,content-type,x-supabase-api-version');res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');
 if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
 const url=new URL(req.url,'http://localhost');res.setHeader('Content-Type','application/json');
 if(url.pathname==='/auth/v1/verify'&&req.method==='GET'){
  const path=url.searchParams.get('cenario')==='painel'?'/':'/aceitar-convite';
  const hash=new URLSearchParams({access_token:jwt(),refresh_token:'fixture_refresh_convite',expires_in:'3600',token_type:'bearer',type:'invite'});
  res.writeHead(303,{Location:appOrigin+path+'#'+hash});res.end();return;
 }
 if(url.pathname==='/auth/v1/verify'&&req.method==='POST'){
  verifyCalls++;let body='';for await(const c of req)body+=c;const input=JSON.parse(body);
  if(!['invite','recovery'].includes(input.type)||![('fixture_'+input.type),'fixture_browser'].includes(input.token_hash)||consumed.has(input.token_hash)){res.writeHead(403);res.end(JSON.stringify({code:'otp_expired',msg:'Token has expired or is invalid'}));return;}
  consumed.add(input.token_hash);res.end(JSON.stringify({access_token:jwt(),refresh_token:'fixture_refresh_convite',expires_in:3600,token_type:'bearer',user}));return;
 }
 if(url.pathname==='/auth/v1/user'){
  const bearer=req.headers.authorization?.split(' ')[1];const claims=bearer?JSON.parse(Buffer.from(bearer.split('.')[1],'base64url')):{};
  res.end(JSON.stringify(claims.sub===oldUser.id?oldUser:user));return;
 }
 if(url.pathname==='/auth/v1/.well-known/jwks.json'){res.end(JSON.stringify({keys:[]}));return;}
 if(url.pathname==='/rest/v1/rpc/obter_contexto_acesso_portal'){res.end(JSON.stringify({usuarioId:user.id,ativo:true,perfis:[]}));return;}
 console.log('Fixture: rota nao prevista',req.method,url.pathname);res.writeHead(404);res.end('{}');
});
async function port(){const s=createServer();s.listen(0,'127.0.0.1');await once(s,'listening');const p=s.address().port;await new Promise(r=>s.close(r));return p;}
try{
 auth.listen(0,'127.0.0.1');await once(auth,'listening');appOrigin='http://127.0.0.1:'+await port();const authOrigin='http://127.0.0.1:'+auth.address().port;
 child=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--webpack','--hostname','127.0.0.1','--port',new URL(appOrigin).port],{cwd:root,windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NEXT_TELEMETRY_DISABLED:'1',NEXT_PUBLIC_SUPABASE_URL:authOrigin,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_local_fixture',SUPABASE_URL:authOrigin,SUPABASE_SECRET_KEY:'',PORTAL_SSO_ORIGIN:appOrigin}});
 child.stdout.on('data',c=>output+=c);child.stderr.on('data',c=>output+=c);const end=Date.now()+120000;
 while(!/Ready in/.test(output)){if(child.exitCode!==null||Date.now()>end)throw new Error(output.slice(-2500));await new Promise(r=>setTimeout(r,300));}
 const key='sb_publishable_local_fixture';let oldCookies=[];
 const previous=createServerClient(authOrigin,key,{cookies:{getAll:()=>[],setAll:c=>{oldCookies=c;}}});
 const seed=await previous.auth.setSession({access_token:jwt(oldUser),refresh_token:'fixture_previous_refresh'});assert.equal(seed.error,null);assert.equal(seed.data.user.id,oldUser.id);
 const oldCookie=oldCookies.map(c=>c.name+'='+c.value).join('; ');
 for(const type of ['invite','recovery']){
  const link=appOrigin+'/auth/confirm?type='+type+'&token_hash=fixture_'+type;const before=verifyCalls;
  for(const method of ['GET','GET','HEAD']){const r=await fetch(link,{method,headers:{cookie:oldCookie},redirect:'manual',signal:AbortSignal.timeout(120000)});assert.equal(r.status,200);assert.match(r.headers.get('cache-control'),/no-store/);if(method==='GET')assert.match(await r.text(),/criar uma nova senha/);}
  assert.equal(verifyCalls,before);
  const options={method:'POST',redirect:'manual',headers:{origin:appOrigin,cookie:oldCookie,'content-type':'application/x-www-form-urlencoded','sec-fetch-site':'same-origin'},body:'type='+type+'&token_hash=fixture_'+type};
  const response=await fetch(appOrigin+'/auth/confirm',options);assert.equal(response.status,303);assert.equal(response.headers.get('location'),appOrigin+'/atualizar-senha');
  const cookies=response.headers.getSetCookie().filter(c=>c.startsWith('sb-')).map(c=>{const pair=c.split(';')[0],i=pair.indexOf('=');return {name:pair.slice(0,i),value:pair.slice(i+1)};});assert.ok(cookies.length);
  const confirmed=createServerClient(authOrigin,key,{cookies:{getAll:()=>cookies,setAll:()=>{}}});const identity=await confirmed.auth.getUser();assert.equal(identity.error,null);assert.equal(identity.data.user.id,user.id);
  const page=await fetch(appOrigin+'/atualizar-senha',{headers:{cookie:cookies.map(c=>c.name+'='+c.value).join('; ')},redirect:'manual',signal:AbortSignal.timeout(120000)});assert.equal(page.status,200);assert.match(await page.text(),/Crie uma nova senha/);
  const reused=await fetch(appOrigin+'/auth/confirm',options);assert.equal(reused.status,303);assert.match(reused.headers.get('location'),/recuperacao-invalida$/);
  console.log('PASS '+type+': GET/HEAD preservam sessão anterior; POST troca identidade e abre senha; reutilização rejeitada.');
 }
 if(process.argv.includes("--browser")){
 console.log('CONVITE_DIRETO='+authOrigin+'/auth/v1/verify?cenario=convite');console.log('CONVITE_PAINEL='+authOrigin+'/auth/v1/verify?cenario=painel');
 console.log('CONVITE_SERVIDOR='+appOrigin+'/auth/confirm?type=invite&token_hash=fixture_browser');
 console.log('Auth ficticio local. Verifique a navegacao sem cadastrar senha. Envie Enter para encerrar.');process.stdin.resume();await once(process.stdin,'data');process.stdin.pause();
 }
}finally{
 if(child?.pid)await new Promise(r=>execFile('taskkill',['/PID',String(child.pid),'/T','/F'],{windowsHide:true},r));
 auth.closeAllConnections();await new Promise(r=>auth.close(r));
}
