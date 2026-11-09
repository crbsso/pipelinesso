import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(new URL("../package.json", import.meta.url));
const ts = require("typescript");
const { NextRequest } = require("next/server");
const url = "https://portal.exemplo.test/auth/confirm";

function ambiente({ expired = false, fail = false } = {}) {
  const calls = [];
  let created = 0;
  const mod = { exports: {} };
  const code = ts.transpileModule(readFileSync(new URL("../src/app/auth/confirm/route.ts", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const importar = p => p === "@/lib/supabase/server" ? {
    createClient: async () => { created++; return { auth: { verifyOtp: async d => {
      calls.push(d); if (fail) throw new Error("indisponível");
      return { error: expired ? { code: "otp_expired" } : null };
    } } }; },
  } : require(p);
  new Function("require", "module", "exports", "process", code)(importar, mod, mod.exports, { env: {} });
  return { ...mod.exports, calls, created: () => created };
}

function post(body = "type=recovery&token_hash=fixture_hash", headers = {}) {
  return new NextRequest(url, { method: "POST", body, headers: {
    origin: "https://portal.exemplo.test", "content-type": "application/x-www-form-urlencoded", ...headers,
  } });
}

test("abrir ou pré-carregar link recovery repetidamente não consome token nem cria cliente Auth", async () => {
  const a = ambiente();
  for (let i = 0; i < 3; i++) {
    const response = await a.GET(new NextRequest(url + "?type=recovery&token_hash=fixture_hash"));
    assert.equal(response.status, 200);
    assert.match(await response.text(), /method="post"/);
    assert.match(response.headers.get("cache-control"), /no-store/);
    assert.equal(response.headers.get("referrer-policy"), "strict-origin");
    assert.match(response.headers.get("content-security-policy"), /frame-ancestors 'none'/);
  }
  assert.equal(a.created(), 0);
  assert.deepEqual(a.calls, []);
});

test("confirmação explícita valida token uma vez e redireciona sem segredo usando GET", async () => {
  const a = ambiente();
  const response = await a.POST(post());
  assert.deepEqual(a.calls, [{ type: "recovery", token_hash: "fixture_hash" }]);
  assert.equal(response.status, 303);
  assert.equal(response.headers.get("location"), "https://portal.exemplo.test/atualizar-senha");
  assert.match(response.headers.get("cache-control"), /no-store/);
});

test("token rejeitado ou falha do serviço não usa sessão existente para liberar nova senha", async () => {
  for (const options of [{ expired: true }, { fail: true }]) {
    const a = ambiente(options);
    const response = await a.POST(post());
    assert.equal(response.headers.get("location"), "https://portal.exemplo.test/signin?erro=recuperacao-invalida");
    assert.equal(a.calls.length, 1);
  }
});

test("origem externa, origem ausente e formato incorreto são rejeitados antes de acessar Auth", async () => {
  for (const [headers, expected] of [
    [{ origin: "https://outro.exemplo.test" }, 403],
    [{ origin: "" }, 403],
    [{ "sec-fetch-site": "cross-site" }, 403],
    [{ "content-type": "application/json" }, 415],
  ]) {
    const a = ambiente();
    assert.equal((await a.POST(post(undefined, headers))).status, expected);
    assert.equal(a.created(), 0);
  }
});

test("parâmetros ausentes, duplicados ou injetados não chegam à validação", async () => {
  for (const body of ["", "type=invite&token_hash=fixture_hash", "type=recovery&token_hash=%22%3E%3Cscript%3E",
    "type=recovery&type=invite&token_hash=x", "type=recovery&token_hash=x&token_hash=y",
    "type=recovery&token_hash=" + "x".repeat(3000)]) {
    const a = ambiente();
    assert.match((await a.POST(post(body))).headers.get("location"), /recuperacao-invalida$/);
    assert.equal(a.created(), 0);
  }
  const a = ambiente();
  for (const query of ["", "?type=recovery", "?type=recovery&token_hash=%22%3E%3Cscript%3E",
    "?type=recovery&token_hash=x&token_hash=y", "?type=recovery&type=invite&token_hash=x"]) {
    assert.match((await a.GET(new NextRequest(url + query))).headers.get("location"), /recuperacao-invalida$/);
  }
  assert.equal(a.created(), 0);
});

test("convite GET mantém o comportamento anterior", async () => {
  const a = ambiente();
  const response = await a.GET(new NextRequest(url + "?type=invite&token_hash=fixture_hash"));
  assert.deepEqual(a.calls, [{ type: "invite", token_hash: "fixture_hash" }]);
  assert.equal(response.status, 307);
  assert.equal(response.headers.get("location"), "https://portal.exemplo.test/atualizar-senha");
});
