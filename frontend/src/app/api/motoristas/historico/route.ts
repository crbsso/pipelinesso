import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { createClient as createServerClient } from "@/lib/supabase/server";
import {
  classificarCondutorHistorico,
  nomeCondutorHistorico,
} from "@/lib/motoristas/historico";

export const dynamic = "force-dynamic";

const headers = {
  "Cache-Control": "private, no-store",
};

const fuso = "America/Sao_Paulo";

type EventoBruto = {
  evento_id: string;
  tipo_evento: string;
  data_evento: string;
  ano_evento: number;
  mes_evento: number;
  inicio: string | null;
  fim: string | null;
  nome_exibicao: string | null;
  driver_id_cobli: string | null;
  situacao_motorista: string | null;
  coligada: string | null;
  secao_rm: string | null;
  placa: string | null;
  distancia_km: number | null;
  duracao_viagem_min: number | null;
  marcha_lenta_min: number | null;
};

function inteiro(
  parametros: URLSearchParams,
  nome: string,
  padrao: number | null,
  minimo: number,
  maximo: number,
): number | null {
  const valores = parametros.getAll(nome);

  if (valores.length > 1) {
    throw new RangeError(`Parametro duplicado: ${nome}`);
  }

  if (valores.length === 0) {
    return padrao;
  }

  const valor = valores[0];

  if (!/^\d+$/.test(valor)) {
    throw new RangeError(`Parametro invalido: ${nome}`);
  }

  const numero = Number(valor);

  if (
    !Number.isSafeInteger(numero) ||
    numero < minimo ||
    numero > maximo
  ) {
    throw new RangeError(`Parametro fora do limite: ${nome}`);
  }

  return numero;
}

function filtroTexto(
  parametros: URLSearchParams,
  nome: string,
): string | null {
  const valores = parametros.getAll(nome);

  if (valores.length > 1) {
    throw new RangeError(`Parametro duplicado: ${nome}`);
  }

  if (valores.length === 0) {
    return null;
  }

  const valor = valores[0].trim();

  if (!valor || valor.length > 150) {
    throw new RangeError(`Parametro invalido: ${nome}`);
  }

  return valor;
}

function instanteUtc(
  valor: string | null,
): Date | null {
  if (!valor) {
    return null;
  }

  // A Cobli fornece timestamps UTC sem indicador de fuso.
  const normalizado = valor.replace(" ", "T");

  const comFuso =
    /(Z|[+-]\d{2}:\d{2})$/i.test(normalizado)
      ? normalizado
      : `${normalizado}Z`;

  const data = new Date(comFuso);

  return Number.isNaN(data.getTime())
    ? null
    : data;
}

function horarioNoturno(
  inicio: string | null,
): boolean | null {
  const data = instanteUtc(inicio);

  if (!data) {
    return null;
  }

  const partes = new Intl.DateTimeFormat("en-GB", {
    timeZone: fuso,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(data);

  const hora = Number(
    partes.find((parte) => parte.type === "hour")?.value,
  );

  const minuto = Number(
    partes.find((parte) => parte.type === "minute")?.value,
  );

  if (!Number.isFinite(hora) || !Number.isFinite(minuto)) {
    return null;
  }

  const minutos = hora * 60 + minuto;

  return minutos >= 18 * 60 + 30 || minutos < 6 * 60;
}

function fimDeSemana(
  dataEvento: string,
): boolean {
  // data_evento ja representa a data local de Sao Paulo.
  const data = new Date(`${dataEvento}T12:00:00Z`);

  if (Number.isNaN(data.getTime())) {
    throw new Error("Data historica invalida.");
  }

  return [0, 6].includes(data.getUTCDay());
}

function prepararResposta(evento: EventoBruto) {
  const status = classificarCondutorHistorico(evento);

  const fimSemana = fimDeSemana(evento.data_evento);
  const noturno = horarioNoturno(evento.inicio);

  const tipoRegistro = (evento.placa ?? "")
    .toUpperCase()
    .includes("OBD")
      ? "OBD"
      : "VEICULO";

  return {
    evento_id: evento.evento_id,
    tipo_evento: evento.tipo_evento,
    data_evento: evento.data_evento,
    ano_evento: evento.ano_evento,
    mes_evento: evento.mes_evento,
    inicio: evento.inicio,
    fim: evento.fim,
    nome_exibicao: nomeCondutorHistorico(evento),
    coligada: evento.coligada ?? "",
    secao_rm: evento.secao_rm ?? "",
    situacao_motorista: evento.situacao_motorista ?? "",
    status_identificacao_condutor: status,
    tipo_registro: tipoRegistro,
    fim_de_semana: fimSemana,
    noturno,
    fim_semana_noturno:
      noturno === null ? null : fimSemana && noturno,
    distancia_km: evento.distancia_km,
    duracao_viagem_min: evento.duracao_viagem_min,
    marcha_lenta_min: evento.marcha_lenta_min,
  };
}

export async function GET(request: NextRequest) {
  // Protecao provisoria enquanto a politica geral de
  // permissoes do Portal SSO nao estiver concluida.
  if (
    process.env.NODE_ENV !== "development" &&
    process.env.SSO_MOTORISTAS_APIS_ENABLED !== "true"
  ) {
    return NextResponse.json(
      { error: "Rota historica em validacao." },
      { status: 404, headers },
    );
  }

  const auth = await createServerClient();

  const {
    data: { user },
    error: erroUsuario,
  } = await auth.auth.getUser();

  if (erroUsuario || !user) {
    return NextResponse.json(
      { error: "Nao autorizado." },
      { status: 401, headers },
    );
  }

  try {
    const parametros = request.nextUrl.searchParams;

    const ano = inteiro(parametros, "ano", null, 2020, 2100);
    const mes = inteiro(parametros, "mes", null, 1, 12);
    const pagina = inteiro(parametros, "pagina", 1, 1, 10000)!;
    const limite = inteiro(parametros, "limite", 50, 1, 100)!;

    const coligada = filtroTexto(parametros, "coligada");
    const secao = filtroTexto(parametros, "secao");
    const motorista = filtroTexto(parametros, "motorista");
    const tipoEvento = filtroTexto(parametros, "tipo_evento");

    if (
      tipoEvento &&
      tipoEvento !== "VIAGEM" &&
      tipoEvento !== "PARADA"
    ) {
      throw new RangeError("Tipo de evento invalido.");
    }

    const url = process.env.SUPABASE_URL;
    const chave = process.env.SUPABASE_SECRET_KEY;

    if (!url || !chave) {
      throw new Error("Configuracao Supabase ausente.");
    }

    const supabase = createSupabaseClient(url, chave, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const colunas = "evento_id,tipo_evento,data_evento,ano_evento,mes_evento,inicio,fim,nome_exibicao,driver_id_cobli,situacao_motorista,coligada,secao_rm,placa,distancia_km,duracao_viagem_min,marcha_lenta_min";

    let consulta = supabase
      .from("fato_motoristas_viagens")
      .select(colunas, { count: "exact" });

    if (ano !== null) {
      consulta = consulta.eq("ano_evento", ano);
    }

    if (mes !== null) {
      consulta = consulta.eq("mes_evento", mes);
    }

    if (coligada) {
      consulta = consulta.eq("coligada", coligada);
    }

    if (secao) {
      consulta = consulta.eq("secao_rm", secao);
    }

    if (motorista) {
      const motoristaLiteral = motorista.replace(/[\\%_]/g, "\\$&");
      consulta = consulta.ilike("nome_exibicao", `%${motoristaLiteral}%`);
    }

    if (tipoEvento) {
      consulta = consulta.eq("tipo_evento", tipoEvento);
    }

    const inicioPagina = (pagina - 1) * limite;

    const { data, error, count } = await consulta
      .order("data_evento", { ascending: false })
      .order("inicio", { ascending: false })
      .order("evento_id", { ascending: true })
      .range(inicioPagina, inicioPagina + limite - 1);

    if (error) {
      throw new Error(error.message);
    }

    const registros = (data ?? []) as EventoBruto[];

    return NextResponse.json(
      {
        dados: {
          eventos: registros.map(prepararResposta),
        },
        paginacao: {
          pagina,
          limite,
          total_registros: count ?? 0,
          total_paginas: Math.ceil((count ?? 0) / limite),
        },
        filtros: {
          ano,
          mes,
          coligada,
          secao,
          motorista,
          tipo_evento: tipoEvento,
        },
      },
      { headers },
    );
  } catch (error) {
    if (error instanceof RangeError) {
      return NextResponse.json(
        { error: error.message },
        { status: 400, headers },
      );
    }

    console.error("Erro na API historica Motoristas:", error);

    return NextResponse.json(
      { error: "Falha ao consultar o historico." },
      { status: 500, headers },
    );
  }
}
