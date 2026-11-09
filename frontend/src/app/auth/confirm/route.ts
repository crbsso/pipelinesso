import { type NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

const privateHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  // Omite caminho/token sem tornar Origin null no POST do formulário nativo.
  "Referrer-Policy": "strict-origin",
  "X-Content-Type-Options": "nosniff",
};

function redirect(request: NextRequest, valid: boolean, status = 303) {
  const url = new URL(valid ? "/atualizar-senha" : "/signin", process.env.PORTAL_SSO_ORIGIN ?? request.url);
  if (!valid) url.searchParams.set("erro", "recuperacao-invalida");
  const response = NextResponse.redirect(url, status);
  for (const [key, value] of Object.entries(privateHeaders)) response.headers.set(key, value);
  return response;
}

function validToken(token: string | null): token is string {
  return token !== null && /^[A-Za-z0-9_-]{1,512}$/.test(token);
}

function validType(type: string | null): type is "invite" | "recovery" {
  return type === "invite" || type === "recovery";
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  // Abrir ou pré-carregar o convite não autentica nem consome o token.
  if (validType(type) && validToken(tokenHash) && searchParams.getAll("token_hash").length === 1
    && searchParams.getAll("type").length === 1) {
    const convite = type === "invite";
    return new NextResponse(`<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>${convite ? "Ativar acesso" : "Redefinir senha"} | Portal SSO</title>
<style>body{margin:0;background:#f8fafc;color:#0f172a;font-family:Arial,sans-serif;display:grid;min-height:100dvh;place-items:center}main{box-sizing:border-box;max-width:440px;margin:24px;padding:32px;background:white;border:1px solid #e2e8f0;border-radius:16px}h1{font-size:26px}p{line-height:1.6;color:#475569}button{width:100%;padding:14px;border:0;border-radius:10px;background:#0f172a;color:white;font-size:16px;cursor:pointer}a{display:block;margin-top:24px;color:#0369a1}button:focus-visible,a:focus-visible{outline:3px solid #38bdf8;outline-offset:4px}</style></head>
<body><main><h1>${convite ? "Ative seu acesso ao Portal SSO" : "Redefinir sua senha"}</h1><p>Para continuar e criar uma nova senha, confirme abaixo.</p>
<form method="post" action="/auth/confirm"><input type="hidden" name="token_hash" value="${tokenHash}">
<input type="hidden" name="type" value="${type}"><button type="submit">${convite ? "Continuar e criar minha senha" : "Continuar redefinição de senha"}</button></form>
${convite ? '<p>Se o convite expirou, solicite um novo ao administrador.</p>' : '<a href="/esqueci-senha">Solicitar outro link</a>'}</main></body></html>`, {
      headers: { ...privateHeaders, "Content-Type": "text/html; charset=utf-8",
        "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'" },
    });
  }

  return redirect(request, false);
}

export async function POST(request: NextRequest) {
  const origin = process.env.PORTAL_SSO_ORIGIN ?? request.nextUrl.origin;
  if (request.headers.get("origin") !== origin
    || (request.headers.has("sec-fetch-site") && request.headers.get("sec-fetch-site") !== "same-origin")) {
    return new NextResponse("Solicitação não permitida.", { status: 403, headers: privateHeaders });
  }
  if (request.headers.get("content-type")?.split(";")[0] !== "application/x-www-form-urlencoded") {
    return new NextResponse("Formato de solicitação inválido.", { status: 415, headers: privateHeaders });
  }
  try {
    const body = await request.text();
    if (body.length > 2048) return redirect(request, false);
    const fields = new URLSearchParams(body);
    const token = fields.get("token_hash");
    const type = fields.get("type");
    if (!validToken(token) || !validType(type)
      || fields.getAll("token_hash").length !== 1 || fields.getAll("type").length !== 1) {
      return redirect(request, false);
    }
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: token });
    return redirect(request, !error);
  } catch {
    return redirect(request, false);
  }
}
