import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

type SolicitacaoAcessoPayload = {
  nomeCompleto?: string;
  emailCorporativo?: string;
  empresa?: string;
  cargoFuncao?: string;
  projetoUnidade?: string;
  justificativa?: string;
};

function texto(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function emailValido(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request: Request) {
  try {
    const body =
      (await request.json()) as SolicitacaoAcessoPayload;

    const nomeCompleto = texto(body.nomeCompleto);
    const emailCorporativo = texto(
      body.emailCorporativo,
    ).toLowerCase();
    const empresa = texto(body.empresa);
    const cargoFuncao = texto(body.cargoFuncao);
    const projetoUnidade = texto(body.projetoUnidade);
    const justificativa = texto(body.justificativa);

    if (
      nomeCompleto.length < 3 ||
      nomeCompleto.length > 150 ||
      !emailValido(emailCorporativo) ||
      emailCorporativo.length > 254 ||
      !empresa ||
      empresa.length > 120 ||
      !cargoFuncao ||
      cargoFuncao.length > 120 ||
      !projetoUnidade ||
      projetoUnidade.length > 150 ||
      !justificativa ||
      justificativa.length > 2000
    ) {
      return NextResponse.json(
        {
          error:
            "Revise os campos obrigatórios e tente novamente.",
        },
        { status: 400 },
      );
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseSecretKey =
      process.env.SUPABASE_SECRET_KEY;

    if (!supabaseUrl || !supabaseSecretKey) {
      console.error(
        "Variáveis de ambiente do Supabase não configuradas para solicitação de acesso.",
      );

      return NextResponse.json(
        {
          error:
            "Não foi possível processar a solicitação neste momento.",
        },
        { status: 500 },
      );
    }

    const supabase = createClient(
      supabaseUrl,
      supabaseSecretKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );

    const { data: existente, error: erroConsulta } =
      await supabase
        .from("solicitacoes_acesso")
        .select("id")
        .eq("email_corporativo", emailCorporativo)
        .eq("status", "PENDENTE")
        .maybeSingle();

    if (erroConsulta) {
      console.error(
        "Erro ao verificar solicitação pendente:",
        erroConsulta.message,
      );

      return NextResponse.json(
        {
          error:
            "Não foi possível processar a solicitação neste momento.",
        },
        { status: 500 },
      );
    }

    if (existente) {
      return NextResponse.json(
        {
          ok: true,
          message:
            "Solicitação registrada para análise.",
        },
        { status: 200 },
      );
    }

    const { error: erroInsert } = await supabase
      .from("solicitacoes_acesso")
      .insert({
        nome_completo: nomeCompleto,
        email_corporativo: emailCorporativo,
        empresa,
        cargo_funcao: cargoFuncao,
        projeto_unidade: projetoUnidade,
        justificativa,
        status: "PENDENTE",
      });

    if (erroInsert) {
      if (erroInsert.code === "23505") {
        return NextResponse.json(
          {
            ok: true,
            message:
              "Solicitação registrada para análise.",
          },
          { status: 200 },
        );
      }

      console.error(
        "Erro ao registrar solicitação de acesso:",
        erroInsert.message,
      );

      return NextResponse.json(
        {
          error:
            "Não foi possível registrar sua solicitação.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        message:
          "Solicitação registrada para análise.",
      },
      { status: 201 },
    );
  } catch (error) {
    console.error(
      "Erro inesperado em solicitação de acesso:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Ocorreu um erro ao processar sua solicitação.",
      },
      { status: 500 },
    );
  }
}
