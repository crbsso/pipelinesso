import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth/requireAdmin";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdmin();

  if (!auth.ok) {
    return auth.response;
  }

  const { data, error } = await auth.supabaseAdmin
    .from("solicitacoes_acesso")
    .select(
      `
        id,
        nome_completo,
        email_corporativo,
        empresa,
        cargo_funcao,
        projeto_unidade,
        justificativa,
        status,
        criado_em,
        atualizado_em,
        analisado_em,
        analisado_por,
        observacao_analise
      `,
    )
    .order("criado_em", {
      ascending: false,
    });

  if (error) {
    console.error(
      "Erro ao consultar solicitações de acesso:",
      error.message,
    );

    return NextResponse.json(
      {
        error:
          "Não foi possível consultar as solicitações de acesso.",
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