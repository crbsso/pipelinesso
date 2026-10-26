"use client";

import { useEffect, useState } from "react";

type Evento = {
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
  eventos: Evento[];
};

type RankingInfracoes = Identidade & {
  total_infracoes: number;
  eventos: Evento[];
};

type Viagem = {
  evento_id_viagem: string;
  inicio: string;
  placa: string;
  excessos_confirmados: number;
  eventos: Evento[];
};

type RankingViagens = Identidade & {
  viagens_qualificadas: number;
  excessos_confirmados: number;
  viagens: Viagem[];
};

type Pendente = {
  evento_id_viagem: string;
  inicio: string;
  placa: string;
  nome_exibicao: string;
  coligada: string;
  secao_rm: string;
  total_eventos_associados: number;
  excessos_confirmados: number;
  excessos_pendentes: number;
};

type Resposta = {
  dados: {
    validacao?: {
      ranking_via_habilitado: boolean;
      ranking_110_habilitado: boolean;
    };
    resumo: {
      total_infracoes_confirmadas: number | null;
      motoristas_com_infracoes: number | null;
      ocorrencias_110: number | null;
      viagens_11_mais: number | null;
      viagens_pendentes: number | null;
      eventos_sem_viagem: number | null;
    };
    ranking_infracoes: RankingInfracoes[];
    ranking_110: Ranking110[];
    ranking_viagens: RankingViagens[];
    viagens_pendentes: Pendente[];
  };
  cobertura?: {
    observacao?: string;
    total_eventos_consultados?: number;
    eventos_no_periodo?: number;
    primeiro_evento_em?: string | null;
    ultimo_evento_em?: string | null;
  };
  error?: string;
};

type Props = {
  coligada: string;
  secao: string;
};

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril",
  "Maio", "Junho", "Julho", "Agosto",
  "Setembro", "Outubro", "Novembro", "Dezembro",
];

function periodoAtual() {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());

  return {
    ano: partes.find((p) => p.type === "year")?.value ?? "2026",
    mes: partes.find((p) => p.type === "month")?.value ?? "10",
  };
}

function formatarHorario(valor: string): string {
  const normalizado = valor.replace(" ", "T");
  const comFuso = /(Z|[+-]\d{2}:\d{2})$/i.test(normalizado)
    ? normalizado
    : `${normalizado}Z`;

  const data = new Date(comFuso);

  if (Number.isNaN(data.getTime())) return valor;

  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(data);
}

function DetalhesEventos({ eventos }: { eventos: Evento[] }) {
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead className="text-gray-500">
          <tr className="border-b dark:border-gray-700">
            <th className="p-2">Data e hora</th>
            <th className="p-2">Velocidade máxima do evento</th>
            <th className="p-2">Limite considerado</th>
            <th className="p-2">Tempo acima do limite informado</th>
          </tr>
        </thead>
        <tbody>
          {eventos.map((evento) => (
            <tr
              key={evento.evento_velocidade_id}
              className="border-b dark:border-gray-800"
            >
              <td className="p-2">{formatarHorario(evento.evento_em)}</td>
              <td className="p-2">{evento.velocidade_kmh} km/h</td>
              <td className="p-2">{evento.limite_kmh} km/h</td>
              <td className="p-2">
                {evento.duracao_acima_limite_segundos} s
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type ModoPeriodo = "MES" | "SEMANA" | "PERSONALIZADO";

type SemanaOpcao = {
  inicio: string;
  fim: string;
  rotulo: string;
};

function semanasDoMes(ano: string, mes: string): SemanaOpcao[] {
  if (!ano || !mes) return [];

  const y = Number(ano);
  const m = Number(mes);

  if (!Number.isInteger(y) || !Number.isInteger(m) ||
      m < 1 || m > 12) return [];

  const ultimo = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const pad = (n: number) => String(n).padStart(2, "0");
  const opcoes: SemanaOpcao[] = [];

  let dia = 1;

  while (dia <= ultimo) {
    const diaSemana = new Date(
      Date.UTC(y, m - 1, dia),
    ).getUTCDay();

    const fim = Math.min(
      ultimo, dia + ((7 - diaSemana) % 7),
    );

    opcoes.push({
      inicio: `${y}-${pad(m)}-${pad(dia)}`,
      fim: `${y}-${pad(m)}-${pad(fim)}`,
      rotulo: `${pad(dia)} a ${pad(fim)}/${pad(m)}/${y}`,
    });

    dia = fim + 1;
  }

  return opcoes;
}

export default function VelocidadeMotoristas({
  coligada,
  secao,
}: Props) {
  const [inicial] = useState(periodoAtual);
  const [ano, setAno] = useState(inicial.ano);
  const [mes, setMes] = useState(inicial.mes);
  const [modoPeriodo, setModoPeriodo] =
    useState<ModoPeriodo>("MES");
  const [semana, setSemana] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [dados, setDados] = useState<Resposta | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  const opcoesSemanas = semanasDoMes(ano, mes);

  const semanaSelecionada =
    opcoesSemanas.find((s) => s.inicio === semana) ??
    opcoesSemanas[0] ??
    null;

  const inicioAplicado =
    modoPeriodo === "SEMANA"
      ? semanaSelecionada?.inicio ?? ""
      : modoPeriodo === "PERSONALIZADO"
        ? dataInicio
        : "";

  const fimAplicado =
    modoPeriodo === "SEMANA"
      ? semanaSelecionada?.fim ?? ""
      : modoPeriodo === "PERSONALIZADO"
        ? dataFim
        : "";

  const periodoValido =
    modoPeriodo === "MES" ||
    (modoPeriodo === "SEMANA" &&
      Boolean(ano && mes && semanaSelecionada)) ||
    (modoPeriodo === "PERSONALIZADO" &&
      Boolean(dataInicio && dataFim && dataInicio <= dataFim));

  useEffect(() => {
    if (!periodoValido) {
      setDados(null);
      setCarregando(false);
      setErro("");
      return;
    }
    const controller = new AbortController();
    const parametros = new URLSearchParams();

    if (modoPeriodo !== "PERSONALIZADO") {
      if (ano) parametros.set("ano", ano);
      if (mes && ano) parametros.set("mes", mes);
    }

    if (modoPeriodo !== "MES") {
      parametros.set("inicio", inicioAplicado);
      parametros.set("fim", fimAplicado);
    }

    if (coligada && coligada !== "TODOS") {
      parametros.set("coligada", coligada);
    }

    if (secao && secao !== "TODOS") {
      parametros.set("secao", secao);
    }


    async function carregar() {
      setCarregando(true);
      setErro("");

      try {
        const resposta = await fetch(
          `/api/motoristas/velocidade?${parametros.toString()}`,
          {
            cache: "no-store",
            signal: controller.signal,
          },
        );

        const resultado = (await resposta.json()) as Resposta;

        if (!resposta.ok) {
          throw new Error(
            resultado.error || `Erro HTTP ${resposta.status}`,
          );
        }

        if (!resultado.dados?.resumo) {
          throw new Error("Resposta da API incompleta.");
        }

        if (!controller.signal.aborted) {
          setDados(resultado);
        }
      } catch (falha) {
        if (!controller.signal.aborted) {
          setDados(null);
          setErro(
            falha instanceof Error
              ? falha.message
              : "Falha ao carregar os rankings.",
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setCarregando(false);
        }
      }
    }

    void carregar();

    return () => controller.abort();
  }, [
    ano, mes, coligada, secao,
    modoPeriodo, periodoValido,
    inicioAplicado, fimAplicado,
  ]);

  const [minimoExcessos, setMinimoExcessos] = useState(10);

  const resumo = dados?.dados.resumo;
  const rankingViaHabilitado =
    dados?.dados.validacao?.ranking_via_habilitado === true;
  const ranking110Habilitado =
    dados?.dados.validacao?.ranking_110_habilitado === true;
  const rankingReincidentes =
    (dados?.dados.ranking_infracoes ?? []).filter(
      (item) => item.total_infracoes >= minimoExcessos,
    );
  const ranking110 = dados?.dados.ranking_110 ?? [];
  const rankingViagens = dados?.dados.ranking_viagens ?? [];
  const pendentes = dados?.dados.viagens_pendentes ?? [];

  // SSO_UX_VELOCIDADE_BLOQUEADA_V1
  // Nao altera os controles de seguranca da API.
  if (
    dados?.dados.validacao?.ranking_via_habilitado === false &&
    dados?.dados.validacao?.ranking_110_habilitado === false
  ) {
    return (
      <section
        aria-label="Velocidade e Infracoes em validacao"
        className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900"
      >
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Velocidade e Infrações
        </h2>
        <p className="mt-2 text-sm font-medium text-gray-600 dark:text-gray-300">
          Indicadores em validação técnica
        </p>
        <p className="mt-4 text-sm leading-6 text-gray-700 dark:text-gray-300">
          Os dados de velocidade da Cobli estão em homologação.
          Os rankings e indicadores permanecerão indisponíveis
          até a aprovação da confiabilidade dos registros.
        </p>
        <p className="mt-4 border-t border-gray-200 pt-4 text-sm text-gray-500 dark:border-gray-800 dark:text-gray-400">
          Isso não significa que não houve infrações.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Velocidade e Infrações
        </h2>

        <p className="mt-1 text-sm text-gray-500">
          Rankings mensais baseados nas ocorrências individuais da Cobli.
          Os dados representam somente o período efetivamente coletado. Eventos de velocidade da via e do limite configurado no veículo são indicadores diferentes. A velocidade exibida representa o valor máximo retornado pela Cobli para o evento. A duração corresponde ao tempo acima do limite indicado na mesma linha.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <label className="text-sm">
            <span className="mb-1 block text-gray-600 dark:text-gray-300">
              Ano
            </span>
            <select
              value={ano}
              disabled={modoPeriodo === "PERSONALIZADO"}
              onChange={(e) => {
                setAno(e.target.value);
                if (!e.target.value) setMes("");
                setSemana("");
              }}
              className="w-full rounded-lg border border-gray-300 bg-transparent p-2 dark:border-gray-700"
            >
              <option value="">Todos os anos</option>
              {Array.from(
                { length: Math.max(1, Number(inicial.ano) - 2019) },
                (_, i) => 2020 + i,
              ).map((valor) => (
                <option key={valor} value={valor}>
                  {valor}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            <span className="mb-1 block text-gray-600 dark:text-gray-300">
              Mês
            </span>
            <select
              value={mes}
              onChange={(e) => {
                setMes(e.target.value);
                setSemana("");
              }}
              disabled={!ano || modoPeriodo === "PERSONALIZADO"}
              className="w-full rounded-lg border border-gray-300 bg-transparent p-2 dark:border-gray-700"
            >
              <option value="">Todos os meses</option>
              {MESES.map((nome, i) => (
                <option key={nome} value={i + 1}>
                  {nome}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            <span className="mb-1 block text-gray-600 dark:text-gray-300">
              Tipo de período
            </span>
            <select
              value={modoPeriodo}
              onChange={(e) =>
                setModoPeriodo(e.target.value as ModoPeriodo)
              }
              className="w-full rounded-lg border border-gray-300 bg-transparent p-2 dark:border-gray-700"
            >
              <option value="MES">Mês inteiro</option>
              <option value="SEMANA">Semana</option>
              <option value="PERSONALIZADO">Período personalizado</option>
            </select>
          </label>

          {modoPeriodo === "SEMANA" && (
            <label className="text-sm">
              <span className="mb-1 block text-gray-600 dark:text-gray-300">
                Semana
              </span>
              <select
                value={semanaSelecionada?.inicio ?? ""}
                onChange={(e) => setSemana(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-transparent p-2 dark:border-gray-700"
              >
                {opcoesSemanas.map((s) => (
                  <option key={s.inicio} value={s.inicio}>
                    {s.rotulo}
                  </option>
                ))}
              </select>
            </label>
          )}

          {modoPeriodo === "PERSONALIZADO" && (
            <>
              <label className="text-sm">
                <span className="mb-1 block text-gray-600 dark:text-gray-300">
                  Data inicial
                </span>
                <input
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-transparent p-2 dark:border-gray-700"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-gray-600 dark:text-gray-300">
                  Data final
                </span>
                <input
                  type="date"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-transparent p-2 dark:border-gray-700"
                />
              </label>
            </>
          )}
        </div>

        {!periodoValido && (
          <p role="alert" className="mt-3 text-sm text-amber-700">
            Selecione uma semana válida ou informe
            as datas inicial e final do período.
          </p>
        )}

        <p className="mt-3 text-xs text-gray-500">
          Filtros gerais aplicados — Coligada: {coligada || "TODOS"};
          Seção RM: {secao || "TODOS"}.
        </p>
      </div>

      {carregando && (
        <p className="text-sm text-gray-500">
          Carregando rankings de velocidade...
        </p>
      )}

      {erro && (
        <div
          role="alert"
          className="rounded-xl border border-red-300 p-4 text-sm text-red-700 dark:text-red-300"
        >
          {erro}
        </div>
      )}

      {!carregando && resumo && (
        <>
          <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
            <h3 className="font-semibold">
              Cobertura dos dados no periodo selecionado
            </h3>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
                <p className="text-xs text-gray-500">
                  Primeiro evento disponivel
                </p>
                <p className="mt-2 text-lg font-semibold">
                  {dados?.cobertura?.primeiro_evento_em
                    ? formatarHorario(dados.cobertura.primeiro_evento_em)
                    : "Nenhum evento no periodo"}
                </p>
              </div>

              <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
                <p className="text-xs text-gray-500">
                  Ultimo evento disponivel
                </p>
                <p className="mt-2 text-lg font-semibold">
                  {dados?.cobertura?.ultimo_evento_em
                    ? formatarHorario(dados.cobertura.ultimo_evento_em)
                    : "Nenhum evento no periodo"}
                </p>
              </div>
            </div>

            <p className="mt-3 text-xs text-gray-500">
              Dados parciais conforme os eventos publicados.
              As datas nao comprovam coleta continua entre elas.
              A cobertura considera todos os eventos de velocidade
              no periodo, independentemente dos filtros de
              Coligada e Secao.
            </p>
          </section>

          {(!rankingViaHabilitado || !ranking110Habilitado) && (
            <p role="status" className="text-sm text-amber-700">
              {"Indicadores de velocidade em valida\u00e7\u00e3o. A cobertura da coleta n\u00e3o comprova infra\u00e7\u00f5es."}
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Excessos da via confirmados", resumo.total_infracoes_confirmadas],
              ["Limite do veículo: >110 km/h por >30 s", resumo.ocorrencias_110],
              ["Viagens com 11+ excessos", resumo.viagens_11_mais],
              ["Viagens pendentes", resumo.viagens_pendentes],
            ].map(([titulo, valor]) => (
              <div
                key={String(titulo)}
                className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]"
              >
                <p className="text-xs text-gray-500">{titulo}</p>
                <p className="mt-2 text-2xl font-semibold">{valor === null ? "Em validação" : valor}</p>
              </div>
            ))}
          </div>

          <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
            <h3 className="font-semibold">
              Ranking — Motoristas com mais excessos do limite da via
            </h3>
            <p className="mt-1 text-xs text-gray-500">
              Classificação por quantidade de eventos Cobli confirmados,
              no período selecionado. Não representa multas oficiais.
              Motoristas com excessos: {rankingViaHabilitado ? resumo.motoristas_com_infracoes : "Em valida\u00e7\u00e3o"}.
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <label
                htmlFor="minimo-excessos"
                className="text-sm font-medium"
              >
                Mínimo de excessos no período
              </label>

              <select
                id="minimo-excessos"
                value={minimoExcessos}
                onChange={(e) =>
                  setMinimoExcessos(Number(e.target.value))
                }
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
              >
                <option value={1}>1 ou mais</option>
                <option value={5}>5 ou mais</option>
                <option value={10}>10 ou mais</option>
                <option value={20}>20 ou mais</option>
              </select>

              <span className="text-sm text-gray-500">
                Motoristas no ranking: {rankingViaHabilitado ? rankingReincidentes.length : "Em valida\u00e7\u00e3o"}
              </span>
            </div>

            {!rankingViaHabilitado || rankingReincidentes.length === 0 ? (
              <p className="mt-4 text-sm text-gray-500">
                {rankingViaHabilitado ? "Nenhum motorista atingiu o m\u00ednimo de excessos para os filtros selecionados." : "Ranking de excessos da via em validacao."}
              </p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-500 dark:bg-gray-800">
                    <tr>
                      <th className="p-3">Posição</th>
                      <th className="p-3">Motorista</th>
                      <th className="p-3">Coligada</th>
                      <th className="p-3">Seção RM</th>
                      <th className="p-3 text-right">Excessos</th>
                      <th className="p-3">Detalhamento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rankingReincidentes.map((item, indice) => (
                      <tr
                        key={`${item.driver_id_cobli}-${item.coligada}-${item.secao_rm}`}
                        className="border-b border-gray-100 align-top dark:border-gray-800"
                      >
                        <td className="p-3 font-semibold">
                          {indice + 1}º
                        </td>
                        <td className="p-3">{item.nome_exibicao}</td>
                        <td className="p-3">{item.coligada}</td>
                        <td className="p-3">{item.secao_rm}</td>
                        <td className="p-3 text-right font-semibold">
                          {item.total_infracoes.toLocaleString("pt-BR")}
                        </td>
                        <td className="p-3">
                          <details>
                            <summary className="cursor-pointer text-blue-600">
                              Ver eventos da via
                            </summary>
                            <DetalhesEventos eventos={item.eventos} />
                          </details>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-gray-200 p-5 dark:border-gray-800">
            <h3 className="font-semibold">
              Ranking 1 — Acima de 110 km/h por mais de 30 segundos
            </h3>
            <p className="mt-1 text-xs text-gray-500">
              Considera a duração informada pela Cobli acima do limite
              configurado de 110 km/h e vínculos confirmados.
            </p>

            {!ranking110Habilitado || ranking110.length === 0 ? (
              <p className="mt-4 text-sm text-gray-500">
                {ranking110Habilitado ? "Nenhuma ocorr\u00eancia confirmada no per\u00edodo consultado." : "Ranking de 110 km/h em validacao."}
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {ranking110.map((item, i) => (
                  <details
                    key={`${item.driver_id_cobli}-${item.coligada}-${item.secao_rm}`}
                    className="rounded-xl border border-gray-200 p-4 dark:border-gray-800"
                  >
                    <summary className="cursor-pointer text-sm font-medium">
                      {i + 1}º — {item.nome_exibicao} —{" "}
                      {item.ocorrencias} ocorrência(s)
                      <span className="ml-2 text-xs text-gray-500">
                        {item.coligada} · {item.secao_rm}
                      </span>
                    </summary>
                    <DetalhesEventos eventos={item.eventos} />
                  </details>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-gray-200 p-5 dark:border-gray-800">
            <h3 className="font-semibold">
              Ranking 2 — Viagens com mais de 10 excessos da via
            </h3>
            <p className="mt-1 text-xs text-gray-500">
              Cada viagem precisa ter pelo menos 11 ocorrências
              confirmadas. O mês corresponde ao início da viagem.
            </p>

            {!rankingViaHabilitado || rankingViagens.length === 0 ? (
              <p className="mt-4 text-sm text-gray-500">
                {rankingViaHabilitado ? "Nenhuma viagem qualificada no per\u00edodo consultado." : "Ranking de viagens em validacao."}
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {rankingViagens.map((item, i) => (
                  <details
                    key={`${item.driver_id_cobli}-${item.coligada}-${item.secao_rm}`}
                    className="rounded-xl border border-gray-200 p-4 dark:border-gray-800"
                  >
                    <summary className="cursor-pointer text-sm font-medium">
                      {i + 1}º — {item.nome_exibicao} —{" "}
                      {item.viagens_qualificadas} viagem(ns) ·{" "}
                      {item.excessos_confirmados} excessos
                      <span className="ml-2 text-xs text-gray-500">
                        {item.coligada} · {item.secao_rm}
                      </span>
                    </summary>

                    <div className="mt-3 space-y-3">
                      {item.viagens.map((viagem) => (
                        <details
                          key={viagem.evento_id_viagem}
                          className="rounded-lg border border-gray-200 p-3 dark:border-gray-700"
                        >
                          <summary className="cursor-pointer text-xs">
                            {formatarHorario(viagem.inicio)} ·{" "}
                            {viagem.placa || "Sem placa"} ·{" "}
                            {viagem.excessos_confirmados} excessos
                          </summary>
                          <DetalhesEventos eventos={viagem.eventos} />
                        </details>
                      ))}
                    </div>
                  </details>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-gray-200 p-5 dark:border-gray-800">
            <h3 className="font-semibold">
              Viagens candidatas com identificação pendente
            </h3>
            <p className="mt-1 text-xs text-gray-500">
              Estas viagens não compõem o ranking confirmado.
              O vínculo do motorista exige verificação.
            </p>
            <p className="mt-2 text-xs text-gray-500">
              Eventos sem viagem no período:{" "}
              {!rankingViaHabilitado ? "Em valida\u00e7\u00e3o" : resumo.eventos_sem_viagem === null ? "Não atribuíveis aos filtros de área ou motorista" : resumo.eventos_sem_viagem}.
            </p>

            {!rankingViaHabilitado || pendentes.length === 0 ? (
              <p className="mt-4 text-sm text-gray-500">
                {rankingViaHabilitado ? "Nenhuma viagem candidata pendente." : "Viagens candidatas em validacao."}
              </p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b dark:border-gray-700">
                      <th className="p-2">Início</th>
                      <th className="p-2">Motorista da viagem</th>
                      <th className="p-2">Placa</th>
                      <th className="p-2">Confirmados</th>
                      <th className="p-2">Pendentes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendentes.map((item) => (
                      <tr
                        key={item.evento_id_viagem}
                        className="border-b dark:border-gray-800"
                      >
                        <td className="p-2">
                          {formatarHorario(item.inicio)}
                        </td>
                        <td className="p-2">
                          {item.nome_exibicao}
                        </td>
                        <td className="p-2">{item.placa}</td>
                        <td className="p-2">
                          {item.excessos_confirmados}
                        </td>
                        <td className="p-2">
                          {item.excessos_pendentes}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <p className="text-xs text-gray-500">
            {dados?.cobertura?.observacao}
          </p>
        </>
      )}
    </div>
  );
}
