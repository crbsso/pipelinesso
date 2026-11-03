import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const raiz = fileURLToPath(new URL("../../", import.meta.url));
const config = JSON.parse(await readFile(path.join(raiz, ".cache/permissoes-hml/config.json"), "utf8"));
if (config.url !== "https://ckfsarzmudwdehiiltwi.supabase.co") throw new Error("Alvo diferente da homologacao autorizada.");
let publica = typeof config.chavePublica === "string" && config.chavePublica.startsWith("sb_publishable_");
if (config.chavePublica?.startsWith("eyJ")) {
  const payload = JSON.parse(Buffer.from(config.chavePublica.split(".")[1], "base64url"));
  publica = payload.role === "anon" && (!payload.ref || payload.ref === "ckfsarzmudwdehiiltwi");
}
if (!publica) throw new Error("O teste aceita somente chave publica.");
const indiceSDK = process.argv.indexOf("--sdk");
const sdk = indiceSDK >= 0 ? process.argv[indiceSDK + 1] : path.join(raiz, "frontend/node_modules/@supabase/supabase-js/dist/umd/supabase.js");
if (!sdk) throw new Error("Biblioteca Supabase nao informada.");
const pastaPublica = fileURLToPath(new URL("./public/", import.meta.url));
const pastaRegras = path.join(raiz, ".cache/permissoes-hml/regras");
const arquivos = new Map([
  ["/", [path.join(pastaPublica, "index.html"), "text/html; charset=utf-8"]],
  ["/teste.js", [path.join(pastaPublica, "teste.js"), "text/javascript; charset=utf-8"]],
  ["/revalidacao.js", [path.join(pastaPublica, "revalidacao.js"), "text/javascript; charset=utf-8"]],
  ["/recuperacao.js", [path.join(pastaPublica, "recuperacao.js"), "text/javascript; charset=utf-8"]],
  ["/estilo.css", [path.join(pastaPublica, "estilo.css"), "text/css; charset=utf-8"]],
  ["/sdk.js", [sdk, "text/javascript; charset=utf-8"]],
  ...["politicaAcesso.js", "carregarContextoAcesso.js", "requirePermission.js"].map((nome) =>
    ["/regras/" + nome, [path.join(pastaRegras, nome), "text/javascript; charset=utf-8"]]),
]);
const csp = "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self' https://ckfsarzmudwdehiiltwi.supabase.co; form-action 'none'; frame-ancestors 'none'; base-uri 'none'";
const servidor = createServer(async (req, res) => {
  const porta = servidor.address()?.port;
  const host = `127.0.0.1:${porta}`;
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Security-Policy", csp);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  if (req.headers.host !== host) { res.writeHead(403); res.end(); return; }
  if (req.method !== "GET" && req.method !== "HEAD") { res.writeHead(405); res.end(); return; }
  const url = new URL(req.url ?? "/", `http://${host}`);
  if (url.pathname === "/config") {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(req.method === "HEAD" ? undefined : JSON.stringify(config)); return;
  }
  const arquivo = arquivos.get(url.pathname);
  if (!arquivo) { res.writeHead(404); res.end(); return; }
  try {
    const bytes = await readFile(arquivo[0]);
    res.setHeader("Content-Type", arquivo[1]);
    res.end(req.method === "HEAD" ? undefined : bytes);
  } catch { res.writeHead(500); res.end("Arquivo de teste indisponivel."); }
});
const indicePorta = process.argv.indexOf("--porta");
const portaTesteHml = indicePorta < 0 ? 0 : Number(process.argv[indicePorta + 1]);
if (!Number.isInteger(portaTesteHml) || portaTesteHml < 0 || portaTesteHml > 65535) throw new Error("Porta invalida");
servidor.listen(portaTesteHml, "127.0.0.1", () => console.log(`TELA_HML=http://127.0.0.1:${servidor.address().port}/`));
