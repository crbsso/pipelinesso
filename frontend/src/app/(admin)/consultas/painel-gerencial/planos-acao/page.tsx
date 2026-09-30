"use client";

import dynamic from "next/dynamic";
import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { ApexOptions } from "apexcharts";

const Chart = dynamic(
  () => import("react-apexcharts"),
  {
    ssr: false,
  },
);

type PlanoAcao = {
  plano_id: string;
  id_resposta: number | null;
  nome_plano: string | null;
  modulo_origem: string | null;
  inicio_plano: string | null;
  criacao_plano: string | null;
  cronograma_plano: string | null;
  encerramento_plano: string | null;
  nivel_organizacional: string | null;
  divisao_plano: string | null;
  estado_plano_fonte: string | null;
  flag_ativo_fonte: number;
  flag_aberto_fonte: number;
  flag_atrasado_fonte: number;
  flag_fechado_fonte: number;
  flag_fechado_apos_prazo_fonte: number;
  data_referencia: string | null;
  dias_para_prazo: number | null;
  dias_em_atraso_calculado: number | null;
  situacao_prazo_calculada: string | null;
  flag_vencido_calculado: number;
  flag_em_prazo_calculado: number;
  flag_vence_hoje: number;
  divergencia_status_prazo: number;
  criador_plano: string | null;
  status_criador: string | null;
  gestor_plano: string | null;
  grupo_sso: string | null;
  metodo_classificacao: string | null;
  descricao_plano: string | null;
  contrato_plano: string | null;
  registros_origem: number | null;
  duplicado_origem: string | null;
};

type RespostaApi = {
  total: number;
  dados: PlanoAcao[];
  error?: string;
};

type Aba =
  | "TODOS"
  | "SEGURANCA"
  | "OUTRAS_AREAS";

function limparTexto(
  valor: string | null | undefined,
) {
  return (valor ?? "").trim();
}

function ordenarUnicos(
  valores: Array<string | null>,
) {
  return Array.from(
    new Set(
      valores
        .map((valor) => limparTexto(valor))
        .filter(Boolean),
    ),
  ).sort((a, b) =>
    a.localeCompare(
      b,
      "pt-BR",
      {
        sensitivity: "base",
      },
    ),
  );
}

function formatarData(
  valor: string | null,
) {
  if (!valor) {
    return "—";
  }

  const partes =
    valor.split("-");

  if (partes.length !== 3) {
    return valor;
  }

  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function nomeGrupo(
  valor: string | null,
) {
  if (valor === "SEGURANCA") {
    return "Segurança";
  }

  if (valor === "OUTRAS_AREAS") {
    return "Outras Áreas";
  }

  return valor ?? "—";
}

function nomeSituacaoPrazo(
  valor: string | null,
) {
  if (valor === "VENCIDO") {
    return "Vencido";
  }

  if (valor === "EM_PRAZO") {
    return "Em prazo";
  }

  if (valor === "NAO_APLICAVEL") {
    return "Não aplicável";
  }

  return valor ?? "—";
}

function descricaoDias(
  plano: PlanoAcao,
) {
  if (
    plano.situacao_prazo_calculada ===
    "VENCIDO"
  ) {
    const dias =
      plano.dias_em_atraso_calculado ?? 0;

    return `${dias} ${
      dias === 1
        ? "dia em atraso"
        : "dias em atraso"
    }`;
  }

  if (
    plano.situacao_prazo_calculada ===
    "EM_PRAZO"
  ) {
    if (plano.flag_vence_hoje === 1) {
      return "Vence hoje";
    }

    const dias =
      plano.dias_para_prazo ?? 0;

    return `Vence em ${dias} ${
      dias === 1
        ? "dia"
        : "dias"
    }`;
  }

  return "—";
}

function contarPor(
  dados: PlanoAcao[],
  obterChave: (
    item: PlanoAcao,
  ) => string,
) {
  const mapa =
    new Map<string, number>();

  dados.forEach((item) => {
    const chave =
      obterChave(item);

    if (!chave) {
      return;
    }

    mapa.set(
      chave,
      (mapa.get(chave) ?? 0) + 1,
    );
  });

  return Array.from(
    mapa.entries(),
  ).sort(
    (a, b) =>
      b[1] - a[1],
  );
}

export default function PlanosAcaoPage() {
  const [
    dados,
    setDados,
  ] = useState<PlanoAcao[]>([]);

  const [
    carregando,
    setCarregando,
  ] = useState(true);

  const [
    erro,
    setErro,
  ] = useState<string | null>(
    null,
  );

  const [
    aba,
    setAba,
  ] = useState<Aba>("TODOS");

  const [
    filtroGestor,
    setFiltroGestor,
  ] = useState("");

  const [
    filtroNivel,
    setFiltroNivel,
  ] = useState("");

  const [
    filtroOrigem,
    setFiltroOrigem,
  ] = useState("");

  const [
    filtroEstado,
    setFiltroEstado,
  ] = useState("");

  const [
    filtroSituacao,
    setFiltroSituacao,
  ] = useState("");

  const [
    prazoDe,
    setPrazoDe,
  ] = useState("");

  const [
    prazoAte,
    setPrazoAte,
  ] = useState("");

  useEffect(() => {
    let ativo = true;

    async function carregar() {
      try {
        setCarregando(true);
        setErro(null);

        const resposta =
          await fetch(
            "/api/planos-acao",
            {
              cache:
                "no-store",
            },
          );

        const resultado =
          (await resposta.json()) as RespostaApi;

        if (!resposta.ok) {
          throw new Error(
            resultado.error ??
              "Não foi possível carregar os Planos de Ação.",
          );
        }

        if (ativo) {
          setDados(
            resultado.dados ??
              [],
          );
        }
      } catch (error) {
        if (ativo) {
          setErro(
            error instanceof Error
              ? error.message
              : "Erro inesperado ao carregar os dados.",
          );
        }
      } finally {
        if (ativo) {
          setCarregando(false);
        }
      }
    }

    void carregar();

    return () => {
      ativo = false;
    };
  }, []);

  const dadosDaAba =
    useMemo(() => {
      if (aba === "TODOS") {
        return dados;
      }

      return dados.filter(
        (item) =>
          item.grupo_sso ===
          aba,
      );
    }, [
      dados,
      aba,
    ]);

  const gestores =
    useMemo(
      () =>
        ordenarUnicos(
          dadosDaAba.map(
            (item) =>
              item.gestor_plano,
          ),
        ),
      [
        dadosDaAba,
      ],
    );

  const niveis =
    useMemo(
      () =>
        ordenarUnicos(
          dadosDaAba.map(
            (item) =>
              item.nivel_organizacional,
          ),
        ),
      [
        dadosDaAba,
      ],
    );

  const origens =
    useMemo(
      () =>
        ordenarUnicos(
          dadosDaAba.map(
            (item) =>
              item.modulo_origem,
          ),
        ),
      [
        dadosDaAba,
      ],
    );

  const estados =
    useMemo(
      () =>
        ordenarUnicos(
          dadosDaAba.map(
            (item) =>
              item.estado_plano_fonte,
          ),
        ),
      [
        dadosDaAba,
      ],
    );

  const situacoes =
    useMemo(
      () =>
        ordenarUnicos(
          dadosDaAba.map(
            (item) =>
              item.situacao_prazo_calculada,
          ),
        ),
      [
        dadosDaAba,
      ],
    );

  const dadosFiltrados =
    useMemo(() => {
      return dadosDaAba.filter(
        (item) => {
          if (
            filtroGestor &&
            item.gestor_plano !==
              filtroGestor
          ) {
            return false;
          }

          if (
            filtroNivel &&
            item.nivel_organizacional !==
              filtroNivel
          ) {
            return false;
          }

          if (
            filtroOrigem &&
            item.modulo_origem !==
              filtroOrigem
          ) {
            return false;
          }

          if (
            filtroEstado &&
            item.estado_plano_fonte !==
              filtroEstado
          ) {
            return false;
          }

          if (
            filtroSituacao &&
            item.situacao_prazo_calculada !==
              filtroSituacao
          ) {
            return false;
          }

          if (
            prazoDe &&
            (
              !item.cronograma_plano ||
              item.cronograma_plano <
                prazoDe
            )
          ) {
            return false;
          }

          if (
            prazoAte &&
            (
              !item.cronograma_plano ||
              item.cronograma_plano >
                prazoAte
            )
          ) {
            return false;
          }

          return true;
        },
      );
    }, [
      dadosDaAba,
      filtroGestor,
      filtroNivel,
      filtroOrigem,
      filtroEstado,
      filtroSituacao,
      prazoDe,
      prazoAte,
    ]);

  const indicadores =
    useMemo(() => {
      return {
        total:
          dadosFiltrados.length,

        ativos:
          dadosFiltrados.filter(
            (item) =>
              item.flag_ativo_fonte ===
              1,
          ).length,

        vencidos:
          dadosFiltrados.filter(
            (item) =>
              item.flag_vencido_calculado ===
              1,
          ).length,

        emPrazo:
          dadosFiltrados.filter(
            (item) =>
              item.flag_em_prazo_calculado ===
              1,
          ).length,
        naoAplicavel:
          dadosFiltrados.filter(
            (item) =>
              item.situacao_prazo_calculada ===
              "NAO_APLICAVEL",
          ).length,

        fechadosAposPrazo:
          dadosFiltrados.filter(
            (item) =>
              item.flag_fechado_apos_prazo_fonte ===
              1,
          ).length,

        divergencias:
          dadosFiltrados.filter(
            (item) =>
              item.divergencia_status_prazo ===
              1,
          ).length,
      };
    }, [
      dadosFiltrados,
    ]);

  const vencidos =
    useMemo(
      () =>
        dadosFiltrados.filter(
          (item) =>
            item.flag_vencido_calculado ===
            1,
        ),
      [
        dadosFiltrados,
      ],
    );

  const aging =
    useMemo(() => {
      const faixas = [
        {
          label:
            "1–30 dias",
          minimo: 1,
          maximo: 30,
        },
        {
          label:
            "31–60 dias",
          minimo: 31,
          maximo: 60,
        },
        {
          label:
            "61–90 dias",
          minimo: 61,
          maximo: 90,
        },
        {
          label:
            "91–180 dias",
          minimo: 91,
          maximo: 180,
        },
        {
          label:
            "181–365 dias",
          minimo: 181,
          maximo: 365,
        },
        {
          label:
            ">365 dias",
          minimo: 366,
          maximo:
            Number.POSITIVE_INFINITY,
        },
      ];

      return faixas.map(
        (faixa) => ({
          label:
            faixa.label,

          quantidade:
            vencidos.filter(
              (item) => {
                const dias =
                  item.dias_em_atraso_calculado ??
                  0;

                return (
                  dias >=
                    faixa.minimo &&
                  dias <=
                    faixa.maximo
                );
              },
            ).length,
        }),
      );
    }, [
      vencidos,
    ]);

  const origemPlanos =
    useMemo(
      () =>
        contarPor(
          dadosFiltrados,
          (item) =>
            item.modulo_origem ??
            "Não informado",
        ),
      [
        dadosFiltrados,
      ],
    );

  const rankingGestores =
    useMemo(
      () =>
        contarPor(
          vencidos,
          (item) =>
            item.gestor_plano ??
            "Não informado",
        ).slice(0, 10),
      [
        vencidos,
      ],
    );

  const opcoesPrazo: ApexOptions = {
    chart: {
      fontFamily:
        "inherit",
    },

    labels: [
      "Vencidos",
      "Em prazo",
      "Não aplicável",
    ],

    colors: [
      "#DC2626",
      "#16A34A",
      "#6B7280",
    ],

    legend: {
      position:
        "bottom",
    },

    dataLabels: {
      enabled: false,
    },

    tooltip: {
      y: {
        formatter: (
          valor,
        ) =>
          String(
            Math.round(
              valor,
            ),
          ),
      },
    },
  };

  const opcoesAging: ApexOptions = {
    chart: {
      toolbar: {
        show: false,
      },

      fontFamily:
        "inherit",
    },

    colors: [
      "#2563EB",
    ],

    dataLabels: {
      enabled: false,
    },

    plotOptions: {
      bar: {
        horizontal: true,
        borderRadius: 4,
      },
    },

    xaxis: {
      categories:
        aging.map(
          (item) =>
            item.label,
        ),

      labels: {
        formatter: (
          valor,
        ) => {
          const numero =
            Number(valor);

          return Number.isInteger(
            numero,
          )
            ? String(numero)
            : "";
        },
      },
    },

    grid: {
      borderColor:
        "#E5E7EB",
    },
  };

  const opcoesOrigem: ApexOptions = {
    chart: {
      toolbar: {
        show: false,
      },

      fontFamily:
        "inherit",
    },

    colors: [
      "#1D4ED8",
      "#F97316",
      "#16A34A",
    ],

    dataLabels: {
      enabled: false,
    },

    plotOptions: {
      bar: {
        borderRadius: 4,
        columnWidth: "55%",
      },
    },

    xaxis: {
      categories:
        origemPlanos.map(
          ([nome]) =>
            nome,
        ),

      labels: {
        rotate: -20,
        trim: false,
      },
    },

    grid: {
      borderColor:
        "#E5E7EB",
    },
  };

  const opcoesGestores: ApexOptions = {
    chart: {
      toolbar: {
        show: false,
      },

      fontFamily:
        "inherit",
    },

    colors: [
      "#DC2626",
    ],

    dataLabels: {
      enabled: false,
    },

    plotOptions: {
      bar: {
        horizontal: true,
        borderRadius: 4,
      },
    },

    xaxis: {
      categories:
        rankingGestores.map(
          ([nome]) =>
            nome,
        ),

      labels: {
        formatter: (
          valor,
        ) => {
          const numero =
            Number(valor);

          return Number.isInteger(
            numero,
          )
            ? String(numero)
            : "";
        },
      },
    },

    grid: {
      borderColor:
        "#E5E7EB",
    },
  };

  function selecionarAba(
    novaAba: Aba,
  ) {
    setAba(novaAba);
    limparFiltros();
  }

  function limparFiltros() {
    setFiltroGestor("");
    setFiltroNivel("");
    setFiltroOrigem("");
    setFiltroEstado("");
    setFiltroSituacao("");
    setPrazoDe("");
    setPrazoAte("");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
          Planos de Ação
        </h1>

        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Acompanhamento gerencial dos Planos de Ação do SSO.
        </p>
      </div>

      <div className="flex gap-6 overflow-x-auto border-b border-gray-200 dark:border-gray-800">
        <AbaButton
          label="Todos"
          ativo={
            aba ===
            "TODOS"
          }
          onClick={() =>
            selecionarAba(
              "TODOS",
            )
          }
        />

        <AbaButton
          label="Segurança"
          ativo={
            aba ===
            "SEGURANCA"
          }
          onClick={() =>
            selecionarAba(
              "SEGURANCA",
            )
          }
        />

        <AbaButton
          label="Outras Áreas"
          ativo={
            aba ===
            "OUTRAS_AREAS"
          }
          onClick={() =>
            selecionarAba(
              "OUTRAS_AREAS",
            )
          }
        />
      </div>

      {carregando && (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-500 shadow-sm dark:border-gray-800 dark:bg-white/[0.03]">
          Carregando Planos de Ação...
        </div>
      )}

      {erro && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          {erro}
        </div>
      )}

      {!carregando &&
        !erro && (
          <>
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-white/[0.03]">
              <div className="mb-4 flex items-center justify-between gap-4">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                  Filtros
                </h2>

                <button
                  type="button"
                  onClick={
                    limparFiltros
                  }
                  className="text-sm font-medium text-blue-600 hover:text-blue-700"
                >
                  Limpar filtros
                </button>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <FiltroSelect
                  label="Gestor"
                  value={
                    filtroGestor
                  }
                  onChange={
                    setFiltroGestor
                  }
                  opcoes={
                    gestores
                  }
                />

                <FiltroSelect
                  label="Nível organizacional"
                  value={
                    filtroNivel
                  }
                  onChange={
                    setFiltroNivel
                  }
                  opcoes={
                    niveis
                  }
                />

                <FiltroSelect
                  label="Módulo de origem"
                  value={
                    filtroOrigem
                  }
                  onChange={
                    setFiltroOrigem
                  }
                  opcoes={
                    origens
                  }
                />

                <FiltroSelect
                  label="Estado da fonte"
                  value={
                    filtroEstado
                  }
                  onChange={
                    setFiltroEstado
                  }
                  opcoes={
                    estados
                  }
                />

                <FiltroSelect
                  label="Situação do prazo"
                  value={
                    filtroSituacao
                  }
                  onChange={
                    setFiltroSituacao
                  }
                  opcoes={
                    situacoes
                  }
                  formatarOpcao={
                    nomeSituacaoPrazo
                  }
                />

                <div className="grid grid-cols-2 gap-3">
                  <FiltroData
                    label="Prazo de"
                    value={
                      prazoDe
                    }
                    onChange={
                      setPrazoDe
                    }
                  />

                  <FiltroData
                    label="Prazo até"
                    value={
                      prazoAte
                    }
                    onChange={
                      setPrazoAte
                    }
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
              <KpiCard
                titulo="Total"
                valor={
                  indicadores.total
                }
              />

              <KpiCard
                titulo="Ativos"
                valor={
                  indicadores.ativos
                }
              />

              <KpiCard
                titulo="Vencidos"
                valor={
                  indicadores.vencidos
                }
              />

              <KpiCard
                titulo="Em prazo"
                valor={
                  indicadores.emPrazo
                }
              />

              <KpiCard
                titulo="Fechados após o prazo"
                valor={
                  indicadores.fechadosAposPrazo
                }
              />

              <KpiCard
                titulo="Divergências"
                valor={
                  indicadores.divergencias
                }
              />
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <GraficoCard
                titulo="Situação dos planos ativos"
              >
                <Chart
                  options={
                    opcoesPrazo
                  }
                  series={[
                    indicadores.vencidos,
                    indicadores.emPrazo,
                    indicadores.naoAplicavel,
                  ]}
                  type="donut"
                  height={
                    310
                  }
                />
              </GraficoCard>

              <GraficoCard
                titulo="Aging dos planos vencidos"
              >
                <Chart
                  options={
                    opcoesAging
                  }
                  series={[
                    {
                      name:
                        "Planos",
                      data:
                        aging.map(
                          (item) =>
                            item.quantidade,
                        ),
                    },
                  ]}
                  type="bar"
                  height={
                    310
                  }
                />
              </GraficoCard>

              <GraficoCard
                titulo="Origem dos Planos de Ação"
              >
                <Chart
                  options={
                    opcoesOrigem
                  }
                  series={[
                    {
                      name:
                        "Planos",
                      data:
                        origemPlanos.map(
                          (
                            [
                              ,
                              quantidade,
                            ],
                          ) =>
                            quantidade,
                        ),
                    },
                  ]}
                  type="bar"
                  height={
                    330
                  }
                />
              </GraficoCard>

              <GraficoCard
                titulo="Gestores com mais planos vencidos"
              >
                <Chart
                  options={
                    opcoesGestores
                  }
                  series={[
                    {
                      name:
                        "Planos vencidos",
                      data:
                        rankingGestores.map(
                          (
                            [
                              ,
                              quantidade,
                            ],
                          ) =>
                            quantidade,
                        ),
                    },
                  ]}
                  type="bar"
                  height={
                    330
                  }
                />
              </GraficoCard>
            </div>

            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-white/[0.03]">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-5 py-4 dark:border-gray-800">
                <div>
                  <h2 className="font-semibold text-gray-900 dark:text-white">
                    Planos cadastrados
                  </h2>

                  <p className="mt-1 text-xs text-gray-500">
                    {
                      dadosFiltrados.length
                    }{" "}
                    registro(s) nos filtros selecionados
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-[1500px] text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-800/50">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">
                        ID
                      </th>

                      <th className="px-4 py-3 text-left font-medium">
                        Plano
                      </th>

                      <th className="px-4 py-3 text-left font-medium">
                        Origem
                      </th>

                      <th className="px-4 py-3 text-left font-medium">
                        Nível organizacional
                      </th>

                      <th className="px-4 py-3 text-left font-medium">
                        Gestor
                      </th>

                      <th className="px-4 py-3 text-left font-medium">
                        Grupo
                      </th>

                      <th className="px-4 py-3 text-left font-medium">
                        Estado da fonte
                      </th>

                      <th className="px-4 py-3 text-left font-medium">
                        Situação do prazo
                      </th>

                      <th className="px-4 py-3 text-left font-medium">
                        Prazo
                      </th>

                      <th className="px-4 py-3 text-left font-medium">
                        Dias
                      </th>

                      <th className="px-4 py-3 text-left font-medium">
                        Alerta
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {dadosFiltrados.map(
                      (plano) => (
                        <tr
                          key={
                            plano.plano_id
                          }
                          className="border-t border-gray-100 dark:border-gray-800"
                        >
                          <td className="whitespace-nowrap px-4 py-3">
                            {
                              plano.plano_id
                            }
                          </td>

                          <td className="min-w-72 px-4 py-3">
                            {
                              plano.nome_plano ??
                              "—"
                            }
                          </td>

                          <td className="min-w-48 px-4 py-3">
                            {
                              plano.modulo_origem ??
                              "—"
                            }
                          </td>

                          <td className="min-w-56 px-4 py-3">
                            {
                              plano.nivel_organizacional ??
                              "—"
                            }
                          </td>

                          <td className="min-w-56 px-4 py-3">
                            {
                              plano.gestor_plano ??
                              "—"
                            }
                          </td>

                          <td className="whitespace-nowrap px-4 py-3">
                            {nomeGrupo(
                              plano.grupo_sso,
                            )}
                          </td>

                          <td className="whitespace-nowrap px-4 py-3">
                            {
                              plano.estado_plano_fonte ??
                              "—"
                            }
                          </td>

                          <td className="whitespace-nowrap px-4 py-3">
                            <PrazoBadge
                              valor={
                                plano.situacao_prazo_calculada
                              }
                            />
                          </td>

                          <td className="whitespace-nowrap px-4 py-3">
                            {formatarData(
                              plano.cronograma_plano,
                            )}
                          </td>

                          <td className="whitespace-nowrap px-4 py-3">
                            {descricaoDias(
                              plano,
                            )}
                          </td>

                          <td className="px-4 py-3">
                            {plano.divergencia_status_prazo ===
                            1 ? (
                              <span className="inline-flex whitespace-nowrap rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
                                Status divergente
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                        </tr>
                      ),
                    )}

                    {dadosFiltrados.length ===
                      0 && (
                      <tr>
                        <td
                          colSpan={
                            11
                          }
                          className="px-5 py-10 text-center text-sm text-gray-500"
                        >
                          Nenhum Plano de Ação encontrado para os filtros selecionados.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
    </div>
  );
}

function KpiCard({
  titulo,
  valor,
}: {
  titulo: string;
  valor: number;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-white/[0.03]">
      <p className="text-xs font-medium text-gray-500">
        {titulo}
      </p>

      <p className="mt-2 text-3xl font-semibold text-gray-900 dark:text-white">
        {valor}
      </p>
    </div>
  );
}

function GraficoCard({
  titulo,
  children,
}: {
  titulo: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-white/[0.03]">
      <h2 className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">
        {titulo}
      </h2>

      {children}
    </div>
  );
}

function AbaButton({
  label,
  ativo,
  onClick,
}: {
  label: string;
  ativo: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={
        onClick
      }
      className={`whitespace-nowrap border-b-2 px-1 pb-3 text-sm font-medium transition ${
        ativo
          ? "border-blue-600 text-blue-600"
          : "border-transparent text-gray-500 hover:text-gray-700"
      }`}
    >
      {label}
    </button>
  );
}

function FiltroSelect({
  label,
  value,
  onChange,
  opcoes,
  formatarOpcao,
}: {
  label: string;
  value: string;
  onChange: (
    valor: string,
  ) => void;
  opcoes: string[];
  formatarOpcao?: (
    valor: string,
  ) => string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-gray-500">
        {label}
      </span>

      <select
        value={
          value
        }
        onChange={(
          evento,
        ) =>
          onChange(
            evento.target.value,
          )
        }
        className="h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 outline-none transition focus:border-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
      >
        <option value="">
          Todos
        </option>

        {opcoes.map(
          (opcao) => (
            <option
              key={
                opcao
              }
              value={
                opcao
              }
            >
              {formatarOpcao
                ? formatarOpcao(
                    opcao,
                  )
                : opcao}
            </option>
          ),
        )}
      </select>
    </label>
  );
}

function FiltroData({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (
    valor: string,
  ) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-gray-500">
        {label}
      </span>

      <input
        type="date"
        value={
          value
        }
        onChange={(
          evento,
        ) =>
          onChange(
            evento.target.value,
          )
        }
        className="h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 outline-none transition focus:border-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
      />
    </label>
  );
}

function PrazoBadge({
  valor,
}: {
  valor: string | null;
}) {
  if (
    valor ===
    "VENCIDO"
  ) {
    return (
      <span className="inline-flex rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-200">
        Vencido
      </span>
    );
  }

  if (
    valor ===
    "EM_PRAZO"
  ) {
    return (
      <span className="inline-flex rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-200">
        Em prazo
      </span>
    );
  }

  return (
    <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
      Não aplicável
    </span>
  );
}