import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
    const authSupabase = await createServerClient();

    const {
     data: { user },
     error: userError,
} = await authSupabase.auth.getUser();

if (userError || !user) {
  return NextResponse.json(
    {
      error: "Não autorizado.",
    },
    {
      status: 401,
      headers: {
        "Cache-Control": "private, no-store",
      },
    },
  );
}

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseSecretKey =
    process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseSecretKey) {
    return NextResponse.json(
      {
        error:
          "Configuração do Supabase não encontrada no ambiente.",
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "private, no-store",
        },
      },
    );
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

  const { data, error } = await supabaseAdmin
    .from("vw_portal_planos_acao")
    .select(
      "modulo_origem,cronograma_plano,nivel_organizacional,flag_ativo_fonte,dias_para_prazo,dias_em_atraso_calculado,situacao_prazo_calculada,situacao_gerencial,flag_vence_hoje,grupo_sso,gestor_exibicao",
    )
    .order(
      "cronograma_plano",
      {
        ascending: true,
      },
    );

  if (error) {
    console.error(
      "Erro ao consultar Planos de Ação:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Não foi possível consultar os Planos de Ação.",
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "private, no-store",
        },
      },
    );
  }

  return NextResponse.json(
    {
      total: data?.length ?? 0,
      dados: data ?? [],
    },
    {
      headers: {
        "Cache-Control": "private, no-store",
      },
    },
  );
}