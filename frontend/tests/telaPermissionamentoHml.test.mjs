import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { readFile } from "node:fs/promises";
import { carregarContextoAcesso } from "../src/lib/auth/carregarContextoAcesso.ts";
import { requirePermission } from "../src/lib/auth/requirePermission.ts";
import { revalidarGestao } from "../../tools/permissionamento-hml/public/revalidacao.js";

test("a tela mostra botoes no topo, habilita apos login e revalida o ciclo sem outro login", async () => {
  const html = await readFile(new URL("../../tools/permissionamento-hml/public/index.html",import.meta.url),"utf8");
  const codigo = await readFile(new URL("../../tools/permissionamento-hml/public/teste.js",import.meta.url),"utf8");
  assert.ok(html.indexOf('id="testes-sessao"') < html.indexOf('id="login"'));
  const elementos = new Map();
  function elemento(id, atributos="") {
    return { id, hidden: /\bhidden\b/.test(atributos), disabled: /\bdisabled\b/.test(atributos),
      value: atributos.match(/\bvalue="([^"]*)"/)?.[1] ?? "", textContent:"", dataset:{}, itens:[], eventos:{},
      addEventListener(nome,funcao){ this.eventos[nome]=funcao; },
      replaceChildren(){ this.itens=[]; }, append(item){ this.itens.push(item); },
      querySelectorAll(){ return this.itens.filter(i=>i.dataset.ok==="false"); },
      querySelector(){ return elemento("filho"); }, scrollIntoView(){ this.rolou=true; },
    };
  }
  for(const m of html.matchAll(/<([a-z]+)\b([^>]*\bid="([^"]+)"[^>]*)>/g)) elementos.set(m[3],elemento(m[3],m[2]));
  const e=id=>{const v=elementos.get(id);if(!v)throw new Error("Elemento ausente: "+id);return v;};
  const inicio=new Date(Date.now()-1000).toISOString();
  const fim=new Date(new Date(inicio).getTime()+86400000).toISOString();
  const config={url:"https://ckfsarzmudwdehiiltwi.supabase.co",chavePublica:"publica_ficticia",email:"seguranca@celeogroup.com",cenario:"administrador",inicioTeste:inicio,fimTeste:fim};
  const estado={ativo:true,logins:0,sessao:false,errosLogin:false};
  const cliente={
    auth:{
      signInWithPassword:async()=>{estado.logins++;estado.sessao=true;return {data:{user:{id:"pessoa_teste"},session:{access_token:"token_ficticio_local"}},error:null};},
      getUser:async()=>({data:{user:{id:"pessoa_teste"}},error:null}),
      getSession:async()=>({data:{session:estado.sessao?{access_token:"token_ficticio_local"}:null},error:null}),
      signOut:async()=>{estado.sessao=false;return {error:null};},
    },
    rpc:async()=>({error:null,data:{usuarioId:"pessoa_teste",ativo:true,perfis:[{perfil:"administracao_acessos_hml",ativo:estado.ativo,inicio,fim,concessoes:["usuarios","permissoes","solicitacoes_acesso"].map(modulo=>({modulo,acoes:["gerenciar"],abrangencia:{tipo:"corporativa"}}))}]}}),
    from:()=>({select:()=>({limit:async()=>({error:{code:"42501"},status:403})})}),
    schema:()=>({from:()=>({select:()=>({limit:async()=>({error:{code:"PGRST106"},status:406})})})}),
  };
  let criacoes=0;
  const escopo={Date,console,carregarContextoAcesso,requirePermission,revalidarGestao,
    extrairTokenRecuperacao:()=>{throw new Error("Recuperacao nao faz parte deste teste");},
    fetch:async()=>({json:async()=>config}),
    window:{supabase:{createClient:()=>++criacoes===1?cliente:{rpc:async()=>({error:{code:"42501"},status:401})}}},
    document:{querySelector:seletor=>e(seletor.slice(1)),createElement:()=>elemento("novo")},
  };
  vm.runInNewContext(codigo.replace(/^import [^\n]*\n/gm,""),escopo);
  await new Promise(setImmediate);
  assert.equal(e("testes-sessao").hidden,false);
  assert.equal(e("testar-bloqueio").disabled,true);
  e("senha").value="senha_ficticia";
  await e("login").eventos.submit({preventDefault(){}});
  assert.equal(e("estado").textContent,"Validação concluída: todas as verificações passaram.");
  assert.equal(e("testar-bloqueio").disabled,false);
  assert.equal(e("testar-reativacao").disabled,false);
  assert.equal(e("testes-sessao").hidden,false);
  assert.equal(e("testes-sessao").rolou,true);
  estado.ativo=false;
  await e("testar-bloqueio").eventos.click();
  assert.equal(e("estado").textContent,"Bloqueio confirmado: todas as verificações passaram, sem novo login.");
  estado.ativo=true;
  await e("testar-reativacao").eventos.click();
  assert.equal(e("estado").textContent,"Reativação confirmada: todas as verificações passaram, sem novo login.");
  assert.equal(estado.logins,1);
  await e("sair").eventos.click();
  assert.equal(e("testar-bloqueio").disabled,true);
  assert.equal(e("testes-sessao").hidden,false);
});
