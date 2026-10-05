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
modulo_origem: string | null;
  cronograma_plano: string | null;
  nivel_organizacional: string | null;
  flag_ativo_fonte: number;
  dias_para_prazo: number | null;
  dias_em_atraso_calculado: number | null;
  situacao_prazo_calculada: string | null;
  situacao_gerencial: string | null;
  flag_vence_hoje: number;
  grupo_sso: string | null;
  gestor_exibicao: string | null;
};

type RespostaApi = {
  total: number;
  dados: PlanoAcao[];
  error?: string;
};

const ORDEM_SITUACOES_GERENCIAIS = [
  "VENCIDO",
  "EM_PRAZO",
  "FECHADO_NO_PRAZO",
  "FECHADO_APOS_PRAZO",
] as const;

const MESES = [
  "01",
  "02",
  "03",
  "04",
  "05",
  "06",
  "07",
  "08",
  "09",
  "10",
  "11",
  "12",
];

const NOMES_MESES: Record<string, string> = {
  "01": "Janeiro",
  "02": "Fevereiro",
  "03": "Março",
  "04": "Abril",
  "05": "Maio",
  "06": "Junho",
  "07": "Julho",
  "08": "Agosto",
  "09": "Setembro",
  "10": "Outubro",
  "11": "Novembro",
  "12": "Dezembro",
};

function nomeSituacaoGerencial(
  valor: string,
) {
  switch (valor) {
    case "VENCIDO":
      return "Vencido";

    case "EM_PRAZO":
      return "Em prazo";

    case "FECHADO_NO_PRAZO":
      return "Fechado no prazo";

    case "FECHADO_APOS_PRAZO":
      return "Fechado após o prazo";

    case "NAO_APLICAVEL":
      return "Não aplicável";

    default:
      return valor;
  }
}

function nomeMes(
  valor: string,
) {
  return NOMES_MESES[valor] ?? valor;
}

type TipoAcao =
  | "PLANO_ACAO"
  | "TAREFA";

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
    tipoAcao,
    setTipoAcao,
  ] = useState<TipoAcao>(
    "PLANO_ACAO",
  );



  const [
    filtroResponsavel,
    setFiltroResponsavel,
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
    filtroSituacao,
    setFiltroSituacao,
  ] = useState("");

  const [
    filtroAno,
    setFiltroAno,
  ] = useState("");

  const [
    filtroMes,
    setFiltroMes,
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


  const responsaveis =
    useMemo(
      () =>
        ordenarUnicos(
          dadosDaAba.map(
            (item) =>
              item.gestor_exibicao,
          ),
        ),
      [
        dadosDaAba,
      ],
    );

  const situacoes =
    useMemo(
      () =>
        ORDEM_SITUACOES_GERENCIAIS.filter(
          (situacao) =>
            dadosDaAba.some(
              (item) =>
                item.situacao_gerencial ===
                situacao,
            ),
        ),
      [
        dadosDaAba,
      ],
    );

  const anos =
    useMemo(() => {
      return Array.from(
        new Set(
          dadosDaAba
            .map(
              (item) =>
                item.cronograma_plano?.slice(
                  0,
                  4,
                ) ?? "",
            )
            .filter(
              (valor) =>
                /^\d{4}$/.test(valor),
            ),
        ),
      ).sort(
        (a, b) =>
          b.localeCompare(a),
      );
    }, [
      dadosDaAba,
    ]);

  const dadosFiltrados =
    useMemo(() => {
      return dadosDaAba.filter(
        (item) => {

          if (
            filtroResponsavel &&
            item.gestor_exibicao !==
              filtroResponsavel
          ) {
            return false;
          }



          if (
            aba !== "SEGURANCA" &&
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
            filtroSituacao &&
            item.situacao_gerencial !==
              filtroSituacao
          ) {
            return false;
          }

          if (
            filtroAno &&
            (
              !item.cronograma_plano ||
              item.cronograma_plano.slice(
                0,
                4,
              ) !== filtroAno
            )
          ) {
            return false;
          }

          if (
            filtroMes &&
            (
              !item.cronograma_plano ||
              item.cronograma_plano.slice(
                5,
                7,
              ) !== filtroMes
            )
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
      filtroResponsavel,
      filtroNivel,
      filtroOrigem,
      filtroSituacao,
      filtroAno,
      filtroMes,
      aba,
      prazoDe,
      prazoAte,
    ]);

  const indicadores =
    useMemo(() => {
      const contarSituacao = (
        situacao: string,
      ) =>
        dadosFiltrados.filter(
          (item) =>
            item.situacao_gerencial ===
            situacao,
        ).length;

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
          contarSituacao(
            "VENCIDO",
          ),

        emPrazo:
          contarSituacao(
            "EM_PRAZO",
          ),

        fechadosNoPrazo:
          contarSituacao(
            "FECHADO_NO_PRAZO",
          ),

        fechadosAposPrazo:
          contarSituacao(
            "FECHADO_APOS_PRAZO",
          ),
      };
    }, [
      dadosFiltrados,
    ]);

  const vencidos =
    useMemo(
      () =>
        dadosFiltrados.filter(
          (item) =>
            item.situacao_gerencial ===
            "VENCIDO",
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

  const rankingResponsaveis =
    useMemo(
      () =>
        contarPor(
          vencidos,
          (item) =>
            item.gestor_exibicao ??
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
      "Fechados no prazo",
      "Fechados após o prazo",
    ],

    colors: [
      "#DC2626",
      "#16A34A",
      "#2563EB",
      "#EA580C",
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

  const opcoesResponsaveis: ApexOptions = {
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
        rankingResponsaveis.map(
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

  function selecionarTipoAcao(
    novoTipo: TipoAcao,
  ) {
    setTipoAcao(
      novoTipo,
    );

    setAba(
      "TODOS",
    );

    limparFiltros();
  }

  function selecionarAba(
    novaAba: Aba,
  ) {
    setAba(novaAba);
    limparFiltros();
  }

  function limparFiltros() {
    setFiltroResponsavel("");
    setFiltroNivel("");
    setFiltroOrigem("");
    setFiltroSituacao("");
    setFiltroAno("");
    setFiltroMes("");
    setPrazoDe("");
    setPrazoAte("");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
          Ações
        </h1>

        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Acompanhamento gerencial de Planos de Ação e Tarefas do SSO.
        </p>
      </div>

      <div className="flex gap-6 overflow-x-auto border-b border-gray-200 dark:border-gray-800">
        <AbaButton
          label="Plano de Ação"
          ativo={
            tipoAcao ===
            "PLANO_ACAO"
          }
          onClick={() =>
            selecionarTipoAcao(
              "PLANO_ACAO",
            )
          }
        />

        <AbaButton
          label="Tarefa"
          ativo={
            tipoAcao ===
            "TAREFA"
          }
          onClick={() =>
            selecionarTipoAcao(
              "TAREFA",
            )
          }
        />
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

      {tipoAcao ===
        "TAREFA" && (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-white/[0.03]">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            Mapeamento de Tarefas do PREVSYS
          </h2>

          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            A estrutura do módulo está preparada. Os dados de Tarefas serão integrados após o mapeamento da fonte, dos campos e das regras de classificação entre Segurança e Outras Áreas.
          </p>
        </div>
      )}

      {tipoAcao ===
        "PLANO_ACAO" &&
        carregando && (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-500 shadow-sm dark:border-gray-800 dark:bg-white/[0.03]">
          Carregando Planos de Ação...
        </div>
      )}

      {tipoAcao ===
        "PLANO_ACAO" &&
        erro && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          {erro}
        </div>
      )}

      {tipoAcao ===
        "PLANO_ACAO" &&
        !carregando &&
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
                  label="Responsável"
                  value={
                    filtroResponsavel
                  }
                  onChange={
                    setFiltroResponsavel
                  }
                  opcoes={
                    responsaveis
                  }
                />

                {aba !== "SEGURANCA" && (
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
                )}

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
                  label="Situação do plano"
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
                    nomeSituacaoGerencial
                  }
                />

                <FiltroSelect
                  label="Ano do prazo"
                  value={
                    filtroAno
                  }
                  onChange={
                    setFiltroAno
                  }
                  opcoes={
                    anos
                  }
                />

                <FiltroSelect
                  label="Mês do prazo"
                  value={
                    filtroMes
                  }
                  onChange={
                    setFiltroMes
                  }
                  opcoes={
                    MESES
                  }
                  formatarOpcao={
                    nomeMes
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
                titulo="Fechados no prazo"
                valor={
                  indicadores.fechadosNoPrazo
                }
              />
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <GraficoCard
                titulo="Situação dos Planos de Ação"
              >
                <Chart
                  key={`situacao-${indicadores.vencidos}-${indicadores.emPrazo}-${indicadores.fechadosNoPrazo}-${indicadores.fechadosAposPrazo}-${dadosFiltrados.length}`}
                  options={
                    opcoesPrazo
                  }
                  series={[
                    indicadores.vencidos,
                    indicadores.emPrazo,
                    indicadores.fechadosNoPrazo,
                    indicadores.fechadosAposPrazo,
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
                titulo="Responsáveis com mais planos vencidos"
              >
                <Chart
                  options={
                    opcoesResponsaveis
                  }
                  series={[
                    {
                      name:
                        "Planos vencidos",
                      data:
                        rankingResponsaveis.map(
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
                  height={310}
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

                      <th className="whitespace-nowrap px-4 py-3 text-left font-medium">
                        ID do Plano
                      </th>





                      <th className="px-4 py-3 text-left font-medium">
                        Responsável
                      </th>

                      <th className="px-4 py-3 text-left font-medium">
                        Origem
                      </th>

                      <th className="px-4 py-3 text-left font-medium">
                        Nível organizacional
                      </th>



                      <th className="px-4 py-3 text-left font-medium">
                        Grupo
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
                          key={plano.plano_id}
                          className="border-t border-gray-100 dark:border-gray-800"
                        >




                                                    <td className="whitespace-nowrap px-4 py-3 font-medium">
                            {plano.plano_id}
                          </td>

<td className="min-w-48 px-4 py-3">
                            {
                              plano.gestor_exibicao ??
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



                          <td className="whitespace-nowrap px-4 py-3">
                            {nomeGrupo(
                              plano.grupo_sso,
                            )}
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


                        </tr>
                      ),
                    )}

                    {dadosFiltrados.length ===
                      0 && (
                      <tr>
                        <td
                          colSpan={
                            9
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
