import { NextResponse } from "next/server";
import {
  createClient as createSupabaseClient,
} from "@supabase/supabase-js";

import {
  createClient as createServerClient,
} from "@/lib/supabase/server";


export const dynamic = "force-dynamic";


const TAMANHO_PAGINA = 1000;


const COLUNAS = [
  "acao_corretiva_id",
  "plano_id",
  "id_resposta",
  "nome_formulario",
  "modulo_origem",
  "data_inicio",
  "prazo",
  "proxima_verificacao",
  "nivel_organizacional",
  "responsavel_exibicao",
  "estado_acao_fonte",
  "estado_aprovacao",
  "flag_ativo_fonte",
  "dias_para_prazo",
  "dias_em_atraso_calculado",
  "situacao_prazo_calculada",
  "situacao_gerencial",
  "flag_vence_hoje",
  "grupo_sso",
].join(",");


export async function GET() {
  const authSupabase =
    await createServerClient();

  const {
    data: {
      user,
    },
    error: userError,
  } =
    await authSupabase.auth.getUser();


  if (
    userError ||
    !user
  ) {
    return NextResponse.json(
      {
        error:
          "Nao autorizado.",
      },
      {
        status: 401,
        headers: {
          "Cache-Control":
            "private, no-store",
        },
      },
    );
  }


  const supabaseUrl =
    process.env.SUPABASE_URL;

  const supabaseSecretKey =
    process.env
      .SUPABASE_SECRET_KEY;


  if (
    !supabaseUrl ||
    !supabaseSecretKey
  ) {
    return NextResponse.json(
      {
        error:
          "Configuracao do Supabase nao encontrada no ambiente.",
      },
      {
        status: 500,
        headers: {
          "Cache-Control":
            "private, no-store",
        },
      },
    );
  }


  const supabaseAdmin =
    createSupabaseClient(
      supabaseUrl,
      supabaseSecretKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );


  try {
    const registros: unknown[] = [];

    let inicio = 0;


    while (true) {
      const fim =
        inicio +
        TAMANHO_PAGINA -
        1;

      const {
        data,
        error,
      } = await supabaseAdmin
        .from(
          "vw_portal_acoes_corretivas",
        )
        .select(
          COLUNAS,
        )
        .order(
          "acao_corretiva_id",
          {
            ascending: true,
          },
        )
        .range(
          inicio,
          fim,
        );


      if (error) {
        throw error;
      }


      const pagina: unknown[] =
      Array.isArray(data)
        ? data
        : [];

      registros.push(
        ...pagina,
      );


      if (
        pagina.length <
        TAMANHO_PAGINA
      ) {
        break;
      }


      inicio +=
        TAMANHO_PAGINA;
    }


    return NextResponse.json(
      {
        total:
          registros.length,

        dados:
          registros,
      },
      {
        headers: {
          "Cache-Control":
            "private, no-store",
        },
      },
    );

  } catch (error) {
    console.error(
      "Erro ao consultar Acoes Corretivas:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Nao foi possivel consultar as Acoes Corretivas.",
      },
      {
        status: 500,
        headers: {
          "Cache-Control":
            "private, no-store",
        },
      },
    );
  }
}
