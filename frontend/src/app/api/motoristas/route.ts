import { NextResponse } from "next/server";
import {
  createClient as createSupabaseClient,
} from "@supabase/supabase-js";

import {
  createClient as createServerClient,
} from "@/lib/supabase/server";


export const dynamic = "force-dynamic";


const TAMANHO_PAGINA = 1000;


function criarSupabaseAdmin(
  supabaseUrl: string,
  supabaseSecretKey: string,
) {
  return createSupabaseClient(
    supabaseUrl,
    supabaseSecretKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}


type SupabaseAdmin =
  ReturnType<
    typeof criarSupabaseAdmin
  >;


async function carregarTabela(
  supabase: SupabaseAdmin,
  tabela: string,
  colunas: string,
) {
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
    } = await supabase
      .from(tabela)
      .select(colunas)
      .range(
        inicio,
        fim,
      );

    if (error) {
      throw new Error(
        `Falha ao consultar ${tabela}: ${error.message}`,
      );
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

  return registros;
}


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
    criarSupabaseAdmin(
      supabaseUrl,
      supabaseSecretKey,
    );


  try {
    const [
      motoristas,
      resumo,
      coligadas,
      viagens,
      usoSetor,
      pendenciasCondutor,
      seguranca,
      rankingUso,
      rankingSeguranca,
    ] =
      await Promise.all([
        carregarTabela(
          supabaseAdmin,
          "mart_motoristas",
          [
            "nome_exibicao",
            "coligada",
            "secao_rm",
            "situacao_motorista",
            "situacao_exibicao",
            "status_cobli",
            "status_rm",
          ].join(","),
        ),

        carregarTabela(
          supabaseAdmin,
          "mart_motoristas_resumo",
          [
            "grupo",
            "indicador",
            "valor",
            "unidade",
          ].join(","),
        ),

        carregarTabela(
          supabaseAdmin,
          "mart_motoristas_coligadas",
          [
            "coligada",
            "motoristas",
            "ativos_rm",
            "a_desabilitar",
            "sem_identidade_rm",
          ].join(","),
        ),

        carregarTabela(
          supabaseAdmin,
          "mart_motoristas_viagens",
          [
            "data_evento",
            "ano_evento",
            "mes_evento",
            "inicio",
            "fim",
            "nome_exibicao",
            "coligada",
            "secao_rm",
            "situacao_motorista",
            "status_identificacao_condutor",
            "tipo_registro",
            "fim_de_semana",
            "noturno",
            "fim_semana_noturno",
            "distancia_km",
            "duracao_viagem_min",
            "marcha_lenta_min",
          ].join(","),
        ),

        carregarTabela(
          supabaseAdmin,
          "mart_motoristas_uso_setor",
          [
            "cenario",
            "secao_rm",
            "viagens",
            "km",
            "motoristas",
          ].join(","),
        ),

        carregarTabela(
          supabaseAdmin,
          "mart_motoristas_pendencias_condutor",
          [
            "cenario",
            "tipo_registro",
            "viagens",
            "km",
            "registros_cobli",
          ].join(","),
        ),

        carregarTabela(
          supabaseAdmin,
          "mart_motoristas_seguranca",
          [
            "nome_exibicao",
            "coligada",
            "secao_rm",
            "distancia_km",
            "tempo_dirigido_min",
            "velocidade_via_eventos_qtd",
            "aceleracao_brusca_qtd",
            "frenagem_brusca_qtd",
            "curva_brusca_qtd",
            "direcao_distraida_qtd",
            "uso_celular_qtd",
            "olhos_fechados_qtd",
            "bocejo_qtd",
            "fumo_qtd",
            "distancia_insegura_qtd",
            "eventos_risco_total",
            "taxa_eventos_100km",
            "elegivel_ranking",
          ].join(","),
        ),

        carregarTabela(
          supabaseAdmin,
          "mart_motoristas_ranking_uso",
          [
            "posicao",
            "nome_exibicao",
            "coligada",
            "secao_rm",
            "distancia_km",
            "viagens",
          ].join(","),
        ),

        carregarTabela(
          supabaseAdmin,
          "mart_motoristas_ranking_seguranca",
          [
            "posicao",
            "ranking",
            "nome_exibicao",
            "coligada",
            "secao_rm",
            "distancia_km",
            "eventos_risco_total",
            "taxa_eventos_100km",
          ].join(","),
        ),
      ]);


    return NextResponse.json(
      {
        quantidades: {
          motoristas:
            motoristas.length,

          resumo:
            resumo.length,

          coligadas:
            coligadas.length,

          viagens:
            viagens.length,

          uso_setor:
            usoSetor.length,

          pendencias_condutor:
            pendenciasCondutor.length,

          seguranca:
            seguranca.length,

          ranking_uso:
            rankingUso.length,

          ranking_seguranca:
            process.env.SSO_RANKING_SEGURANCA_ENABLED === "true"
              ? rankingSeguranca.length
              : null,
        },

        validacao: {
          ranking_seguranca_habilitado:
            process.env.SSO_RANKING_SEGURANCA_ENABLED === "true",
        },

        dados: {
          motoristas,
          resumo,
          coligadas,
          viagens,

          uso_setor:
            usoSetor,

          pendencias_condutor:
            pendenciasCondutor,

          seguranca,

          ranking_uso:
            rankingUso,

          ranking_seguranca:
            process.env.SSO_RANKING_SEGURANCA_ENABLED === "true"
              ? rankingSeguranca
              : [],
        },
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
      "Erro ao consultar Motoristas:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Nao foi possivel consultar os dados de Motoristas.",
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
