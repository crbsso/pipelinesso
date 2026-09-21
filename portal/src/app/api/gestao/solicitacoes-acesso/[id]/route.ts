import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth/requireAdmin";

type AcaoSolicitacao =
  | "APROVAR"
  | "REJEITAR";

type Payload = {
  acao?: AcaoSolicitacao;
  observacao?: string;
};

function uuidValido(valor: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    valor,
  );
}

export async function PATCH(
  request: Request,
  {
    params,
  }: {
    params: Promise<{
      id: string;
    }>;
  },
) {
  const auth = await requireAdmin();

  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await params;

  if (!uuidValido(id)) {
    return NextResponse.json(
      {
        error: "Identificador da solicitação inválido.",
      },
      {
        status: 400,
        headers: {
          "Cache-Control": "private, no-store",
        },
      },
    );
  }

  let body: Payload;

  try {
    body = (await request.json()) as Payload;
  } catch {
    return NextResponse.json(
      {
        error: "Conteúdo da requisição inválido.",
      },
      {
        status: 400,
        headers: {
          "Cache-Control": "private, no-store",
        },
      },
    );
  }

  const acao = body.acao;

  if (
    acao !== "APROVAR" &&
    acao !== "REJEITAR"
  ) {
    return NextResponse.json(
      {
        error:
          "A ação deve ser APROVAR ou REJEITAR.",
      },
      {
        status: 400,
        headers: {
          "Cache-Control": "private, no-store",
        },
      },
    );
  }

  const observacao =
    typeof body.observacao === "string"
      ? body.observacao.trim()
      : "";

  if (observacao.length > 2000) {
    return NextResponse.json(
      {
        error:
          "A observação deve possuir no máximo 2000 caracteres.",
      },
      {
        status: 400,
        headers: {
          "Cache-Control": "private, no-store",
        },
      },
    );
  }

  const novoStatus =
    acao === "APROVAR"
      ? "APROVADO"
      : "REJEITADO";

  const agora = new Date().toISOString();

  const { data, error } =
    await auth.supabaseAdmin
      .from("solicitacoes_acesso")
      .update({
        status: novoStatus,
        analisado_em: agora,
        analisado_por: auth.userId,
        observacao_analise:
          observacao || null,
        atualizado_em: agora,
      })
      .eq("id", id)
      .eq("status", "PENDENTE")
      .select(
        `
          id,
          nome_completo,
          email_corporativo,
          status,
          analisado_em,
          analisado_por,
          observacao_analise,
          atualizado_em
        `,
      )
      .maybeSingle();

  if (error) {
    console.error(
      "Erro ao analisar solicitação de acesso:",
      error.message,
    );

    return NextResponse.json(
      {
        error:
          "Não foi possível atualizar a solicitação.",
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "private, no-store",
        },
      },
    );
  }

  if (!data) {
    return NextResponse.json(
      {
        error:
          "A solicitação não existe ou já foi analisada.",
      },
      {
        status: 409,
        headers: {
          "Cache-Control": "private, no-store",
        },
      },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      solicitacao: data,
    },
    {
      headers: {
        "Cache-Control": "private, no-store",
      },
    },
  );
}