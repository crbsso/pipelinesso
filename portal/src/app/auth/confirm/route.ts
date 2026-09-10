import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const redirectTo = request.nextUrl.clone();

  // Remove o token da URL que ficará visível ao usuário.
  redirectTo.search = "";

  if (tokenHash && type === "recovery") {
    const supabase = await createClient();

    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });

    if (!error) {
      redirectTo.pathname = "/atualizar-senha";
      return NextResponse.redirect(redirectTo);
    }
  }

  redirectTo.pathname = "/signin";
  redirectTo.searchParams.set("erro", "recuperacao-invalida");

  return NextResponse.redirect(redirectTo);
}