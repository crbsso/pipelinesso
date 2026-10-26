import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const HEADERS = { "Cache-Control": "private, no-store" };
const TAMANHO_PAGINA = 1000;
const MAX_EVENTOS = 50000;

type Evento = {
  evento_velocidade_id: string;
  tipo_evento: string;
  evento_em: string;
  data_evento: string;
  ano_evento: number;
  mes_evento: number;
  evento_id_viagem: string | null;
  driver_id_cobli: string | null;
  vehicle_id_cobli: string;
  status_vinculo: string;
  velocidade_kmh: number;
  limite_kmh: number;
  duracao_acima_limite_segundos: number;
};

type Viagem = {
  evento_id: string;
  inicio: string;
  vehicle_id_cobli: string | null;
  driver_id_cobli: string | null;
  nome_exibicao: string | null;
  driver_name_cobli: string | null;
  coligada: string | null;
  secao_rm: string | null;
  placa: string | null;
};

function criarSupabaseAdmin(url: string, chave: string) {
  return createSupabaseClient(url, chave, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

type Cliente = ReturnType<typeof criarSupabaseAdmin>;

type DetalheEvento = {
  evento_velocidade_id: string;
  evento_em: string;
  velocidade_kmh: number;
  limite_kmh: number;
  duracao_acima_limite_segundos: number;
};

type Identidade = {
  driver_id_cobli: string;
  nome_exibicao: string;
  coligada: string;
  secao_rm: string;
};

type Ranking110 = Identidade & {
  ocorrencias: number;
  eventos: DetalheEvento[];
};

type RankingInfracoes = Identidade & {
  total_infracoes: number;
  eventos: DetalheEvento[];
};

type DetalheViagem = {
  evento_id_viagem: string;
  inicio: string;
  placa: string;
  excessos_confirmados: number;
  eventos: DetalheEvento[];
};

type RankingViagens = Identidade & {
  viagens_qualificadas: number;
  excessos_confirmados: number;
  viagens: DetalheViagem[];
};

function numero(
  parametros: URLSearchParams,
  nome: string,
  minimo: number,
  maximo: number,
): number | null {
  const valores = parametros.getAll(nome);

  if (valores.length > 1) {
    throw new RangeError(`Parametro duplicado: ${nome}`);
  }

  if (!valores.length) return null;

  if (!/^\d+$/.test(valores[0])) {
    throw new RangeError(`Parametro invalido: ${nome}`);
  }

  const valor = Number(valores[0]);

  if (
    !Number.isSafeInteger(valor) ||
    valor < minimo ||
    valor > maximo
  ) {
    throw new RangeError(`Parametro fora do limite: ${nome}`);
  }

  return valor;
}

function texto(
  parametros: URLSearchParams,
  nome: string,
): string | null {
  const valores = parametros.getAll(nome);

  if (valores.length > 1) {
    throw new RangeError(`Parametro duplicado: ${nome}`);
  }

  if (!valores.length) return null;

  const valor = valores[0].trim();

  if (!valor || valor.length > 150) {
    throw new RangeError(`Parametro invalido: ${nome}`);
  }

  return valor.toUpperCase() === "TODOS" ? null : valor;
}

function mesLocal(inicio: string): {
  ano: number;
  mes: number;
  data: string;
} {
  // Na tabela historica, inicio e UTC sem indicador de fuso.
  const valor = inicio.trim().replace(" ", "T");

  const normalizado =
    /(Z|[+-]\d{2}:\d{2})$/i.test(valor)
      ? valor
      : `${valor}Z`;

  const data = new Date(normalizado);

  if (Number.isNaN(data.getTime())) {
    throw new Error("Inicio de viagem invalido.");
  }

  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(data);

  const ano = Number(
    partes.find((p) => p.type === "year")?.value,
  );

  const mes = Number(
    partes.find((p) => p.type === "month")?.value,
  );

  if (!ano || !mes) {
    throw new Error("Falha na conversao de fuso horario.");
  }

  const dia = Number(
    partes.find((p) => p.type === "day")?.value,
  );

  if (!dia) {
    throw new Error("Dia local invalido.");
  }

  const dataLocal = [
    String(ano).padStart(4, "0"),
    String(mes).padStart(2, "0"),
    String(dia).padStart(2, "0"),
  ].join("-");

  return { ano, mes, data: dataLocal };
}

function dentroDoIntervalo(
  data: string,
  inicio: string | null,
  fim: string | null,
): boolean {
  return (
    (inicio === null || data >= inicio) &&
    (fim === null || data <= fim)
  );
}

function dataFiltro(
  parametros: URLSearchParams,
  nome: string,
): string | null {
  const valores = parametros.getAll(nome);

  if (valores.length === 0) return null;

  if (valores.length !== 1) {
    throw new RangeError("Parametro duplicado: " + nome);
  }

  const valor = valores[0];

  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    throw new RangeError("Data invalida: " + nome);
  }

  const data = new Date(valor + "T00:00:00Z");

  if (
    !Number.isFinite(data.getTime()) ||
    data.toISOString().slice(0, 10) !== valor ||
    Number(valor.slice(0, 4)) < 2020 ||
    Number(valor.slice(0, 4)) > 2100
  ) {
    throw new RangeError("Data invalida: " + nome);
  }

  return valor;
}

function noPeriodo(
  anoRegistro: number,
  mesRegistro: number,
  ano: number | null,
  mes: number | null,
): boolean {
  return (
    (ano === null || anoRegistro === ano) &&
    (mes === null || mesRegistro === mes)
  );
}

function correspondeFiltros(
  viagem: Viagem,
  coligada: string | null,
  secao: string | null,
  motorista: string | null,
): boolean {
  if (coligada && viagem.coligada !== coligada) {
    return false;
  }

  if (secao && viagem.secao_rm !== secao) {
    return false;
  }

  if (
    motorista &&
    viagem.nome_exibicao !== motorista &&
    viagem.driver_name_cobli !== motorista &&
    viagem.driver_id_cobli !== motorista
  ) {
    return false;
  }

  return true;
}

function identidade(viagem: Viagem): Identidade {
  if (!viagem.driver_id_cobli) {
    throw new Error("Viagem confirmada sem identificador.");
  }

  return {
    driver_id_cobli: viagem.driver_id_cobli,
    nome_exibicao:
      viagem.nome_exibicao ||
      viagem.driver_name_cobli ||
      "Nome nao disponivel",
    coligada: viagem.coligada ?? "",
    secao_rm: viagem.secao_rm ?? "",
  };
}

function chaveMotorista(viagem: Viagem): string {
  return JSON.stringify([
    viagem.driver_id_cobli,
    viagem.coligada ?? "",
    viagem.secao_rm ?? "",
  ]);
}

function detalhe(evento: Evento): DetalheEvento {
  return {
    evento_velocidade_id: evento.evento_velocidade_id,
    evento_em: evento.evento_em,
    velocidade_kmh: evento.velocidade_kmh,
    limite_kmh: evento.limite_kmh,
    duracao_acima_limite_segundos:
      evento.duracao_acima_limite_segundos,
  };
}

function confirmado(
  evento: Evento,
  viagem: Viagem,
): boolean {
  return (
    evento.status_vinculo === "VINCULO_CONFIRMADO" &&
    Boolean(evento.driver_id_cobli) &&
    evento.driver_id_cobli === viagem.driver_id_cobli &&
    evento.vehicle_id_cobli === viagem.vehicle_id_cobli
  );
}

async function buscarEventos(cliente: Cliente): Promise<Evento[]> {
  const todos: Evento[] = [];

  while (true) {
    const inicio = todos.length;

    const { data, error } = await cliente
      .from("fato_motoristas_eventos_velocidade")
      .select(
        "evento_velocidade_id,tipo_evento,evento_em,data_evento,ano_evento,mes_evento,evento_id_viagem,driver_id_cobli,vehicle_id_cobli,status_vinculo,velocidade_kmh,limite_kmh,duracao_acima_limite_segundos",
      )
      .order("evento_velocidade_id", { ascending: true })
      .range(inicio, inicio + TAMANHO_PAGINA - 1);

    if (error) throw new Error(error.message);

    const pagina = (data ?? []) as Evento[];

    todos.push(...pagina);

    if (todos.length > MAX_EVENTOS) {
      throw new Error(
        "Limite de seguranca atingido. " +
        "Necessaria agregacao no banco de dados.",
      );
    }

    if (pagina.length < TAMANHO_PAGINA) break;

    if (pagina.length === 0) {
      throw new Error("Paginacao de eventos inconsistente.");
    }
  }

  return todos;
}

async function buscarViagens(
  cliente: Cliente,
  eventos: Evento[],
): Promise<Map<string, Viagem>> {
  const identificadores = [
    ...new Set(
      eventos
        .map((evento) => evento.evento_id_viagem)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const viagens = new Map<string, Viagem>();

  for (let inicio = 0; inicio < identificadores.length; inicio += 50) {
    const lote = identificadores.slice(inicio, inicio + 50);

    const { data, error } = await cliente
      .from("fato_motoristas_viagens")
      .select(
        "evento_id,inicio,vehicle_id_cobli,driver_id_cobli,nome_exibicao,driver_name_cobli,coligada,secao_rm,placa",
      )
      .in("evento_id", lote);

    if (error) throw new Error(error.message);

    for (const viagem of (data ?? []) as Viagem[]) {
      viagens.set(viagem.evento_id, viagem);
    }
  }

  if (viagens.size !== identificadores.length) {
    throw new Error(
      "Viagens vinculadas nao recuperadas integralmente.",
    );
  }

  return viagens;
}

function montarRankings(
  eventos: Evento[],
  viagens: Map<string, Viagem>,
  filtros: {
    ano: number | null;
    mes: number | null;
    coligada: string | null;
    secao: string | null;
    motorista: string | null;
    inicio: string | null;
    fim: string | null;
  },
) {
  const ranking110 = new Map<string, Ranking110>();
  const rankingInfracoes = new Map<string, RankingInfracoes>();

  const gruposViagem = new Map<
    string,
    {
      viagem: Viagem;
      confirmados: Evento[];
      pendentes: Evento[];
    }
  >();

  let eventosSemViagem = 0;

  for (const evento of eventos) {
    const viagem = evento.evento_id_viagem
      ? viagens.get(evento.evento_id_viagem)
      : undefined;

    if (evento.tipo_evento === "vehicle-speed-events") {
      if (
        !(noPeriodo(
          evento.ano_evento,
          evento.mes_evento,
          filtros.ano,
          filtros.mes,
        ) && dentroDoIntervalo(evento.data_evento, filtros.inicio, filtros.fim)) ||
        evento.limite_kmh !== 110 ||
        evento.velocidade_kmh <= 110 ||
        evento.duracao_acima_limite_segundos <= 30 ||
        !viagem ||
        !confirmado(evento, viagem) ||
        !correspondeFiltros(
          viagem,
          filtros.coligada,
          filtros.secao,
          filtros.motorista,
        )
      ) {
        continue;
      }

      const chave = chaveMotorista(viagem);

      let item = ranking110.get(chave);

      if (!item) {
        item = {
          ...identidade(viagem),
          ocorrencias: 0,
          eventos: [],
        };
        ranking110.set(chave, item);
      }

      item.ocorrencias += 1;
      item.eventos.push(detalhe(evento));
      continue;
    }

    if (evento.tipo_evento !== "road-speed-events") {
      throw new Error("Tipo de evento de velocidade desconhecido.");
    }

    if (!viagem) {
      if (
        !filtros.coligada &&
        !filtros.secao &&
        !filtros.motorista &&
        (noPeriodo(
          evento.ano_evento,
          evento.mes_evento,
          filtros.ano,
          filtros.mes,
        ) && dentroDoIntervalo(evento.data_evento, filtros.inicio, filtros.fim))
      ) {
        eventosSemViagem += 1;
      }
      continue;
    }

    // O Top 10 usa o mes da ocorrencia, nao o mes da viagem.
    if (
      confirmado(evento, viagem) &&
      (noPeriodo(
        evento.ano_evento,
        evento.mes_evento,
        filtros.ano,
        filtros.mes,
      ) && dentroDoIntervalo(evento.data_evento, filtros.inicio, filtros.fim)) &&
      correspondeFiltros(
        viagem,
        filtros.coligada,
        filtros.secao,
        filtros.motorista,
      )
    ) {
      const chave = chaveMotorista(viagem);
      let item = rankingInfracoes.get(chave);

      if (!item) {
        item = {
          ...identidade(viagem),
          total_infracoes: 0,
          eventos: [],
        };
        rankingInfracoes.set(chave, item);
      }

      item.total_infracoes += 1;
      item.eventos.push(detalhe(evento));
    }

    const periodo = mesLocal(viagem.inicio);

    if (
      !(noPeriodo(
        periodo.ano,
        periodo.mes,
        filtros.ano,
        filtros.mes,
      ) && dentroDoIntervalo(periodo.data, filtros.inicio, filtros.fim)) ||
      !correspondeFiltros(
        viagem,
        filtros.coligada,
        filtros.secao,
        filtros.motorista,
      )
    ) {
      continue;
    }

    let grupo = gruposViagem.get(viagem.evento_id);

    if (!grupo) {
      grupo = {
        viagem,
        confirmados: [],
        pendentes: [],
      };
      gruposViagem.set(viagem.evento_id, grupo);
    }

    if (confirmado(evento, viagem)) {
      grupo.confirmados.push(evento);
    } else {
      grupo.pendentes.push(evento);
    }
  }

  const rankingInfracoesOrdenado = [
    ...rankingInfracoes.values(),
  ].sort(
    (a, b) =>
      b.total_infracoes - a.total_infracoes ||
      a.nome_exibicao.localeCompare(b.nome_exibicao, "pt-BR"),
  );

  const rankingViagens = new Map<string, RankingViagens>();

  const viagensPendentes: Array<{
    evento_id_viagem: string;
    inicio: string;
    placa: string;
    nome_exibicao: string;
    coligada: string;
    secao_rm: string;
    total_eventos_associados: number;
    excessos_confirmados: number;
    excessos_pendentes: number;
  }> = [];

  for (const grupo of gruposViagem.values()) {
    const { viagem, confirmados, pendentes } = grupo;
    const total = confirmados.length + pendentes.length;

    if (confirmados.length >= 11) {
      const chave = chaveMotorista(viagem);

      let item = rankingViagens.get(chave);

      if (!item) {
        item = {
          ...identidade(viagem),
          viagens_qualificadas: 0,
          excessos_confirmados: 0,
          viagens: [],
        };

        rankingViagens.set(chave, item);
      }

      item.viagens_qualificadas += 1;
      item.excessos_confirmados += confirmados.length;

      item.viagens.push({
        evento_id_viagem: viagem.evento_id,
        inicio: viagem.inicio,
        placa: viagem.placa ?? "",
        excessos_confirmados: confirmados.length,
        eventos: confirmados.map(detalhe),
      });
    } else if (total >= 11) {
      viagensPendentes.push({
        evento_id_viagem: viagem.evento_id,
        inicio: viagem.inicio,
        placa: viagem.placa ?? "",
        nome_exibicao:
          viagem.nome_exibicao ||
          viagem.driver_name_cobli ||
          "Identificacao pendente",
        coligada: viagem.coligada ?? "",
        secao_rm: viagem.secao_rm ?? "",
        total_eventos_associados: total,
        excessos_confirmados: confirmados.length,
        excessos_pendentes: pendentes.length,
      });
    }
  }

  const resultado110 = [...ranking110.values()].sort(
    (a, b) =>
      b.ocorrencias - a.ocorrencias ||
      a.nome_exibicao.localeCompare(b.nome_exibicao, "pt-BR"),
  );

  const resultadoViagens = [...rankingViagens.values()].sort(
    (a, b) =>
      b.viagens_qualificadas - a.viagens_qualificadas ||
      b.excessos_confirmados - a.excessos_confirmados ||
      a.nome_exibicao.localeCompare(b.nome_exibicao, "pt-BR"),
  );

  for (const item of resultadoViagens) {
    item.viagens.sort(
      (a, b) =>
        b.excessos_confirmados - a.excessos_confirmados,
    );
  }

  viagensPendentes.sort(
    (a, b) =>
      b.total_eventos_associados - a.total_eventos_associados,
  );

  const resultado = {
    resumo: {
      total_infracoes_confirmadas:
        rankingInfracoesOrdenado.reduce(
          (total, item) => total + item.total_infracoes,
          0,
        ),
      motoristas_com_infracoes:
        rankingInfracoesOrdenado.length,
      ocorrencias_110: resultado110.reduce(
        (total, item) => total + item.ocorrencias,
        0,
      ),
      viagens_11_mais: resultadoViagens.reduce(
        (total, item) => total + item.viagens_qualificadas,
        0,
      ),
      viagens_pendentes: viagensPendentes.length,
      eventos_sem_viagem:
        filtros.coligada || filtros.secao || filtros.motorista
          ? null
          : eventosSemViagem,
    },
    ranking_infracoes: rankingInfracoesOrdenado,
    ranking_110: resultado110,
    ranking_viagens: resultadoViagens,
    viagens_pendentes: viagensPendentes,
  };

  const viaAtiva =
    process.env.SSO_VELOCIDADE_RANKINGS_VIA_ENABLED === "true";
  const limite110Ativo =
    process.env.SSO_VELOCIDADE_RANKING_110_ENABLED === "true";

  return {
    ...resultado,
    validacao: {
      ranking_via_habilitado: viaAtiva,
      ranking_110_habilitado: limite110Ativo,
    },
    resumo: {
      ...resultado.resumo,
      total_infracoes_confirmadas: viaAtiva
        ? resultado.resumo.total_infracoes_confirmadas : null,
      motoristas_com_infracoes: viaAtiva
        ? resultado.resumo.motoristas_com_infracoes : null,
      ocorrencias_110: limite110Ativo
        ? resultado.resumo.ocorrencias_110 : null,
      viagens_11_mais: viaAtiva
        ? resultado.resumo.viagens_11_mais : null,
      viagens_pendentes: viaAtiva
        ? resultado.resumo.viagens_pendentes : null,
      eventos_sem_viagem: viaAtiva
        ? resultado.resumo.eventos_sem_viagem : null,
    },
    ranking_infracoes: viaAtiva ? resultado.ranking_infracoes : [],
    ranking_110: limite110Ativo ? resultado.ranking_110 : [],
    ranking_viagens: viaAtiva ? resultado.ranking_viagens : [],
    viagens_pendentes: viaAtiva ? resultado.viagens_pendentes : [],
  };
}

export async function GET(request: NextRequest) {
  // Mesma protecao provisoria da API historica.
  if (
    process.env.NODE_ENV !== "development" &&
    process.env.SSO_MOTORISTAS_APIS_ENABLED !== "true"
  ) {
    return NextResponse.json(
      { error: "Rota de velocidade em validacao." },
      { status: 404, headers: HEADERS },
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
      { status: 401, headers: HEADERS },
    );
  }

  try {
    const parametros = request.nextUrl.searchParams;

    const filtros = {
      ano: numero(parametros, "ano", 2020, 2100),
      mes: numero(parametros, "mes", 1, 12),
      coligada: texto(parametros, "coligada"),
      secao: texto(parametros, "secao"),
      motorista: texto(parametros, "motorista"),
      inicio: dataFiltro(parametros, "inicio"),
      fim: dataFiltro(parametros, "fim"),
    };

    if ((filtros.inicio === null) !== (filtros.fim === null)) {
      throw new RangeError("Informe as duas datas.");
    }

    if (
      filtros.inicio !== null &&
      filtros.fim !== null &&
      filtros.inicio > filtros.fim
    ) {
      throw new RangeError("Data inicial posterior a final.");
    }

    if (filtros.mes !== null && filtros.ano === null) {
      throw new RangeError("Informe o ano ao filtrar por mes.");
    }

    const url = process.env.SUPABASE_URL;
    const chave = process.env.SUPABASE_SECRET_KEY;

    if (!url || !chave) {
      throw new Error("Configuracao Supabase ausente.");
    }

    const cliente = criarSupabaseAdmin(url, chave);

    const eventos = await buscarEventos(cliente);
    const viagens = await buscarViagens(cliente, eventos);


    let primeiroInstante: number | null = null;
    let ultimoInstante: number | null = null;
    let eventosNoPeriodo = 0;

    for (const evento of eventos) {
      if (
        !(noPeriodo(
          evento.ano_evento,
          evento.mes_evento,
          filtros.ano,
          filtros.mes,
        ) && dentroDoIntervalo(evento.data_evento, filtros.inicio, filtros.fim))
      ) {
        continue;
      }

      eventosNoPeriodo += 1;

      const instante = Date.parse(evento.evento_em);

      if (!Number.isFinite(instante)) continue;

      if (primeiroInstante === null || instante < primeiroInstante) {
        primeiroInstante = instante;
      }

      if (ultimoInstante === null || instante > ultimoInstante) {
        ultimoInstante = instante;
      }
    }

    const primeiroEventoEm =
      primeiroInstante === null
        ? null
        : new Date(primeiroInstante).toISOString();

    const ultimoEventoEm =
      ultimoInstante === null
        ? null
        : new Date(ultimoInstante).toISOString();

    const dados = montarRankings(eventos, viagens, filtros);

    return NextResponse.json(
      {
        dados,
        filtros,
        cobertura: {
          observacao:
            "Resultados parciais conforme os eventos publicados. " +
            "Ausencia de ocorrencias nao comprova ausencia de infracoes.",
          total_eventos_consultados: eventos.length,
          eventos_no_periodo: eventosNoPeriodo,
          primeiro_evento_em: primeiroEventoEm,
          ultimo_evento_em: ultimoEventoEm,
        },
      },
      { headers: HEADERS },
    );
  } catch (error) {
    if (error instanceof RangeError) {
      return NextResponse.json(
        { error: error.message },
        { status: 400, headers: HEADERS },
      );
    }

    console.error("Erro na API velocidade Motoristas:", error);

    return NextResponse.json(
      { error: "Falha ao consultar rankings de velocidade." },
      { status: 500, headers: HEADERS },
    );
  }
}
