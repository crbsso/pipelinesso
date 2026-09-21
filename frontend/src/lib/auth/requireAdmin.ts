import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { createClient as createServerClient } from "@/lib/supabase/server";

const privateHeaders = {
  "Cache-Control": "private, no-store",
};

export async function requireAdmin() {
  const authSupabase = await createServerClient();

  const { data: claimsData, error: claimsError } =
    await authSupabase.auth.getClaims();

  const userId =
    !claimsError &&
    claimsData?.claims &&
    typeof claimsData.claims.sub === "string"
      ? claimsData.claims.sub
      : null;

  if (!userId) {
    return {
      ok: false as const,
      response: NextResponse.json(
        {
          error: "Não autorizado.",
        },
        {
          status: 401,
          headers: privateHeaders,
        },
      ),
    };
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseSecretKey) {
    console.error(
      "Configuração administrativa do Supabase não encontrada.",
    );

    return {
      ok: false as const,
      response: NextResponse.json(
        {
          error:
            "Configuração do servidor não encontrada.",
        },
        {
          status: 500,
          headers: privateHeaders,
        },
      ),
    };
  }

  const supabaseAdmin = createSupabaseClient(
    supabaseUrl,
    supabaseSecretKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );

  const { data: perfil, error: perfilError } =
    await supabaseAdmin
      .from("perfis_portal")
      .select("papel, ativo")
      .eq("user_id", userId)
      .maybeSingle();

  if (perfilError) {
    console.error(
      "Erro ao validar perfil administrativo:",
      perfilError.message,
    );

    return {
      ok: false as const,
      response: NextResponse.json(
        {
          error:
            "Não foi possível validar as permissões do usuário.",
        },
        {
          status: 500,
          headers: privateHeaders,
        },
      ),
    };
  }

  if (
    !perfil ||
    perfil.papel !== "ADMIN_SSO" ||
    perfil.ativo !== true
  ) {
    return {
      ok: false as const,
      response: NextResponse.json(
        {
          error:
            "Você não possui permissão administrativa.",
        },
        {
          status: 403,
          headers: privateHeaders,
        },
      ),
    };
  }

  return {
    ok: true as const,
    userId,
    supabaseAdmin,
  };
}