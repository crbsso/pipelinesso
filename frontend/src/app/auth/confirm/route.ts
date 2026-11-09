import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

const privateHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};

function redirect(request: NextRequest, valid: boolean, status = 303) {
  const url = request.nextUrl.clone();
  url.search = "";
  url.pathname = valid ? "/atualizar-senha" : "/signin";
  if (!valid) url.searchParams.set("erro", "recuperacao-invalida");
  const response = NextResponse.redirect(url, status);
  for (const [key, value] of Object.entries(privateHeaders)) response.headers.set(key, value);
  return response;
}

function validToken(token: string | null): token is string {
  return token !== null && /^[A-Za-z0-9_-]{1,512}$/.test(token);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  // Scanners de e-mail podem abrir o link antes da pessoa. GET não consome recovery.
  if (type === "recovery" && validToken(tokenHash) && searchParams.getAll("token_hash").length === 1
    && searchParams.getAll("type").length === 1) {
    return new NextResponse(`<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Redefinir senha | Portal SSO</title>
<style>body{margin:0;background:#f8fafc;color:#0f172a;font-family:Arial,sans-serif;display:grid;min-height:100dvh;place-items:center}main{box-sizing:border-box;max-width:440px;margin:24px;padding:32px;background:white;border:1px solid #e2e8f0;border-radius:16px}h1{font-size:26px}p{line-height:1.6;color:#475569}button{width:100%;padding:14px;border:0;border-radius:10px;background:#0f172a;color:white;font-size:16px;cursor:pointer}a{display:block;margin-top:24px;color:#0369a1}button:focus-visible,a:focus-visible{outline:3px solid #38bdf8;outline-offset:4px}</style></head>
<body><main><h1>Redefinir sua senha</h1><p>Para continuar e criar uma nova senha, confirme abaixo.</p>
<form method="post" action="/auth/confirm"><input type="hidden" name="token_hash" value="${tokenHash}">
<input type="hidden" name="type" value="recovery"><button type="submit">Continuar redefinição de senha</button></form>
<a href="/esqueci-senha">Solicitar outro link</a></main></body></html>`, {
      headers: { ...privateHeaders, "Content-Type": "text/html; charset=utf-8",
        "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'" },
    });
  }

  // Preserva o fluxo de convites existente.
  if (tokenHash && type === "invite") {
    const supabase = await createClient();

    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });

    if (!error) {
      return redirect(request, true, 307);
    }
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
    if (!validToken(token) || fields.get("type") !== "recovery"
      || fields.getAll("token_hash").length !== 1 || fields.getAll("type").length !== 1) {
      return redirect(request, false);
    }
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type: "recovery", token_hash: token });
    return redirect(request, !error);
  } catch {
    return redirect(request, false);
  }
}
