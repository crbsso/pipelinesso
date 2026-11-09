// Integração local: Next e SDK reais; Auth fictício exclusivamente em loopback.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createHmac } from "node:crypto";
import { spawn, execFile } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const user = { id: "00000000-0000-4000-8000-000000000038", aud: "authenticated", role: "authenticated",
  email: "fixture@example.test", email_confirmed_at: new Date().toISOString(),
  created_at: new Date().toISOString(), app_metadata: { provider: "email", providers: ["email"] }, user_metadata: {}, identities: [] };
let consumed = false, verifyCalls = 0, child, serverOutput = "";
function jwt() {
  const encode = o => Buffer.from(JSON.stringify(o)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const content = encode({ alg: "HS256", typ: "JWT" }) + "." + encode({ sub: user.id, aud: "authenticated",
    role: "authenticated", email: user.email, iat: now, exp: now + 3600 });
  return content + "." + createHmac("sha256", "local-fixture-only").update(content).digest("base64url");
}
const auth = createServer(async (req, res) => {
  res.setHeader("Content-Type", "application/json");
  const path = new URL(req.url, "http://localhost").pathname;
  if (path === "/auth/v1/verify" && req.method === "POST") {
    verifyCalls++;
    if (process.argv.includes("--browser")) console.log("Auth local: confirmação recebida (" + verifyCalls + ").");
    let body = ""; for await (const chunk of req) body += chunk;
    const input = JSON.parse(body);
    if (consumed || input.type !== "recovery" || input.token_hash !== "fixture_integration_hash") {
      res.statusCode = 403; res.end(JSON.stringify({ code: "otp_expired", msg: "Token has expired or is invalid" })); return;
    }
    consumed = true;
    res.end(JSON.stringify({ access_token: jwt(), refresh_token: "fixture_refresh_only", token_type: "bearer",
      expires_in: 3600, user })); return;
  }
  if (path === "/auth/v1/user") { res.end(JSON.stringify(user)); return; }
  if (path === "/auth/v1/.well-known/jwks.json") { res.end(JSON.stringify({ keys: [] })); return; }
  res.statusCode = 404; res.end(JSON.stringify({ error: "Unexpected fixture endpoint" }));
});
async function port() {
  const server = createServer(); server.listen(0, "127.0.0.1"); await once(server, "listening");
  const value = server.address().port; await new Promise(resolve => server.close(resolve)); return value;
}
try {
  auth.listen(0, "127.0.0.1"); await once(auth, "listening");
  const appOrigin = `http://127.0.0.1:${await port()}`;
  const authOrigin = `http://127.0.0.1:${auth.address().port}`;
  child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--webpack", "--hostname", "127.0.0.1", "--port", new URL(appOrigin).port], {
    cwd: root, windowsHide: true, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env,
      NEXT_TELEMETRY_DISABLED: "1", NEXT_PUBLIC_SUPABASE_URL: authOrigin,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_local_fixture", SUPABASE_URL: authOrigin,
      SUPABASE_SECRET_KEY: "", PORTAL_SSO_ORIGIN: appOrigin },
  });
  child.stdout.on("data", chunk => { serverOutput += chunk.toString(); });
  child.stderr.on("data", chunk => { serverOutput += chunk.toString(); });
  const deadline = Date.now() + 120000;
  while (!/Ready in/.test(serverOutput)) {
    if (child.exitCode !== null || Date.now() > deadline) throw new Error("Next não iniciou: " + serverOutput.slice(-3000));
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  const link = appOrigin + "/auth/confirm?type=recovery&token_hash=fixture_integration_hash";
  if (process.argv.includes("--browser")) {
    console.log("BROWSER_URL=" + link);
    console.log("Aguardando verificação do formulário no navegador. Envie Enter para encerrar.");
    process.stdin.resume();
    await once(process.stdin, "data");
    process.stdin.pause();
    assert.equal(verifyCalls, 1);
    assert.equal(consumed, true);
    console.log("PASS: confirmação pelo navegador chegou uma vez ao Auth simulado.");
  } else {
  for (const method of ["GET", "GET", "HEAD"]) {
    const r = await fetch(link, { method, redirect: "manual", signal: AbortSignal.timeout(120000) });
    assert.equal(r.status, 200); assert.match(r.headers.get("cache-control"), /no-store/);
    if (method === "GET") assert.match(await r.text(), /Continuar redefinição de senha/);
  }
  assert.equal(verifyCalls, 0);
  console.log("PASS: GET repetido e HEAD não consumiram token pelo Next real.");
  const form = { method: "POST", redirect: "manual", body: "type=recovery&token_hash=fixture_integration_hash",
    headers: { origin: appOrigin, "content-type": "application/x-www-form-urlencoded", "sec-fetch-site": "same-origin" } };
  const r = await fetch(appOrigin + "/auth/confirm", form);
  assert.equal(r.status, 303); assert.equal(r.headers.get("location"), appOrigin + "/atualizar-senha");
  const cookies = r.headers.getSetCookie().filter(c => /sb-.*auth-token/.test(c));
  assert.ok(cookies.length > 0, "Next deve enviar os cookies da sessão no redirecionamento");
  const cookie = cookies.map(c => c.split(";")[0]).join("; ");
  assert.equal(verifyCalls, 1);
  console.log("PASS: POST validou uma vez e Next enviou cookies no redirecionamento 303.");
  const page = await fetch(appOrigin + "/atualizar-senha", { headers: { cookie }, redirect: "manual", signal: AbortSignal.timeout(120000) });
  assert.equal(page.status, 200); assert.match(await page.text(), /Crie uma nova senha/);
  console.log("PASS: proxy reconheceu sessão e a tela de nova senha foi renderizada.");
  const reused = await fetch(appOrigin + "/auth/confirm", { ...form, headers: { ...form.headers, cookie } });
  assert.equal(reused.status, 303); assert.match(reused.headers.get("location"), /recuperacao-invalida$/);
  assert.equal(new URL(reused.headers.get("location")).origin, appOrigin);
  console.log("PASS: token reutilizado rejeitado mesmo com cookie de sessão existente.");
  }
} catch (error) {
  console.error(serverOutput.slice(-4000)); throw error;
} finally {
  if (child?.pid) {
    if (process.platform === "win32") await new Promise(resolve => execFile("taskkill", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true }, resolve));
    else child.kill("SIGTERM");
  }
  auth.closeAllConnections(); await new Promise(resolve => auth.close(resolve));
}
