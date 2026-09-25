"use client";

import dynamic from "next/dynamic";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

import type { ApexOptions } from "apexcharts";

const Chart = dynamic(
  () => import("react-apexcharts"),
  {
    ssr: false,
  },
);

type Inspecao = {
  id_resposta: string;
  nome_formulario: string;
  contrato: string | null;
  data_inspecao: string;
  area_organizacional: string;
  local: string;
  empresa_inspecao: string | null;
  estado_plano_acao: string;
  acoes_corretivas_atrasadas: number | null;
  cod_colaborador: string;
  status_vinculo_colaborador: string;
  nome_exibicao: string;
  cargo_colaborador: string;
  setor_colaborador: string;
  empresa_colaborador: string;
  data_atualizacao: string;
};

type Aba =
  | "GERAL"
  | "SEGURANCA"
  | "OUTRAS"
  | "TERCEIRAS";

const SETOR_SEGURANCA =
  "SEGURANÇA E SAÚDE OCUPACIONAL";

const MESES = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

function limparTexto(
  valor: string | null | undefined,
) {
  return String(
    valor ?? "",
  ).trim();
}

function ordenarUnicos(
  valores: Array<
    string | null | undefined
  >,
) {
  return Array.from(
    new Set(
      valores
        .map(limparTexto)
        .filter(Boolean),
    ),
  ).sort((a, b) =>
    a.localeCompare(
      b,
      "pt-BR",
    ),
  );
}

function extrairData(
  valor: string,
) {
  if (!valor) {
    return null;
  }

  const data = new Date(
    valor,
  );

  if (
    Number.isNaN(
      data.getTime(),
    )
  ) {
    return null;
  }

  return data;
}

function formatarData(
  valor: string,
) {
  const data =
    extrairData(
      valor,
    );

  if (!data) {
    return "-";
  }

  return new Intl.DateTimeFormat(
    "pt-BR",
  ).format(data);
}

function labelPlano(
  status: string,
) {
  switch (
    limparTexto(
      status,
    )
  ) {
    case "Sin plan":
      return "Sem plano";

    case "Atrasado":
      return "Atrasado";

    case "Aberto":
      return "Aberto";

    case "Encerrado":
      return "Encerrado";

    case "Encerrado após o prazo":
      return "Encerrado após o prazo";

    default:
      return (
        limparTexto(
          status,
        ) || "-"
      );
  }
}

function badgePlano(
  status: string,
) {
  switch (
    limparTexto(
      status,
    )
  ) {
    case "Atrasado":
      return "bg-red-50 text-red-700 ring-red-600/20";

    case "Aberto":
      return "bg-blue-50 text-blue-700 ring-blue-600/20";

    case "Encerrado":
      return "bg-emerald-50 text-emerald-700 ring-emerald-600/20";

    case "Encerrado após o prazo":
      return "bg-violet-50 text-violet-700 ring-violet-600/20";

    default:
      return "bg-gray-50 text-gray-600 ring-gray-500/20";
  }
}

function contarPor(
  dados: Inspecao[],
  obterChave: (
    item: Inspecao,
  ) => string,
) {
  const mapa =
    new Map<
      string,
      number
    >();

  dados.forEach(
    (item) => {
      const chave =
        limparTexto(
          obterChave(
            item,
          ),
        );

      if (
        !chave ||
        chave === "-"
      ) {
        return;
      }

      mapa.set(
        chave,
        (
          mapa.get(
            chave,
          ) ?? 0
        ) + 1,
      );
    },
  );

  return Array.from(
    mapa.entries(),
  ).sort(
    (
      a,
      b,
    ) =>
      b[1] - a[1],
  );
}

export default function InspecoesPage() {
  const [
    dados,
    setDados,
  ] =
    useState<
      Inspecao[]
    >([]);

  const [
    carregando,
    setCarregando,
  ] =
    useState(
      true,
    );

  const [
    erro,
    setErro,
  ] =
    useState(
      "",
    );

  const [
    aba,
    setAba,
  ] =
    useState<Aba>(
      "GERAL",
    );

  const [
    ano,
    setAno,
  ] =
    useState(
      "TODOS",
    );

  const [
    mes,
    setMes,
  ] =
    useState(
      "TODOS",
    );

  const [
    colaborador,
    setColaborador,
  ] =
    useState(
      "TODOS",
    );

  const [
    setor,
    setSetor,
  ] =
    useState(
      "TODOS",
    );

  const [
    local,
    setLocal,
  ] =
    useState(
      "TODOS",
    );

  const [
    contrato,
    setContrato,
  ] =
    useState(
      "TODOS",
    );

  const [
    formulario,
    setFormulario,
  ] =
    useState(
      "TODOS",
    );

  const [
    empresa,
    setEmpresa,
  ] =
    useState(
      "TODOS",
    );

  useEffect(
    () => {
      async function carregar() {
        try {
          setCarregando(
            true,
          );

          setErro(
            "",
          );

          const resposta =
            await fetch(
              "/api/inspecoes",
              {
                cache:
                  "no-store",
              },
            );

          if (
            !resposta.ok
          ) {
            throw new Error(
              "Falha ao consultar inspeções.",
            );
          }

          const resultado =
            await resposta.json();

          setDados(
            resultado.dados ??
              [],
          );
        } catch (
          error
        ) {
          console.error(
            error,
          );

          setErro(
            "Não foi possível carregar os dados de Inspeções.",
          );
        } finally {
          setCarregando(
            false,
          );
        }
      }

      carregar();
    },
    [],
  );

  const anos =
    useMemo(
      () => {
        const valores =
          dados
            .map(
              (
                item,
              ) => {
                const data =
                  extrairData(
                    item.data_inspecao,
                  );

                return data
                  ? String(
                      data.getFullYear(),
                    )
                  : "";
              },
            )
            .filter(
              Boolean,
            );

        return Array.from(
          new Set(
            valores,
          ),
        ).sort(
          (
            a,
            b,
          ) =>
            Number(
              b,
            ) -
            Number(
              a,
            ),
        );
      },
      [
        dados,
      ],
    );

  const dadosBaseAba =
    useMemo(
      () => {
        if (
          aba === "SEGURANCA"
        ) {
          return dados.filter(
            (item) =>
              item.setor_colaborador ===
              SETOR_SEGURANCA,
          );
        }

        if (
          aba === "OUTRAS"
        ) {
          return dados.filter(
            (item) =>
              item.setor_colaborador !==
              SETOR_SEGURANCA,
          );
        }

        if (
          aba === "TERCEIRAS"
        ) {
          return dados.filter(
            (item) =>
              Boolean(
                limparTexto(
                  item.empresa_inspecao,
                ),
              ),
          );
        }

        return dados;
      },
      [
        dados,
        aba,
      ],
    );

  const setores =
    useMemo(
      () =>
        ordenarUnicos(
          dadosBaseAba.map(
            (item) =>
              item.setor_colaborador,
          ),
        ),
      [
        dadosBaseAba,
      ],
    );

  const colaboradores =
    useMemo(
      () => {
        const base =
          setor === "TODOS"
            ? dadosBaseAba
            : dadosBaseAba.filter(
                (item) =>
                  item.setor_colaborador ===
                  setor,
              );

        return ordenarUnicos(
          base.map(
            (item) =>
              item.nome_exibicao,
          ),
        );
      },
      [
        dadosBaseAba,
        setor,
      ],
    );

  const locais =
    useMemo(
      () =>
        ordenarUnicos(
          dados.map(
            (item) =>
              item.local,
          ),
        ),
      [
        dados,
      ],
    );

  const contratos =
    useMemo(
      () =>
        ordenarUnicos(
          dados.map(
            (item) =>
              item.contrato,
          ),
        ),
      [
        dados,
      ],
    );

  const formularios =
    useMemo(
      () =>
        ordenarUnicos(
          dados.map(
            (item) =>
              item.nome_formulario,
          ),
        ),
      [
        dados,
      ],
    );

  const empresas =
    useMemo(
      () => {
        if (
          aba === "SEGURANCA" ||
          aba === "OUTRAS"
        ) {
          return [];
        }

        return ordenarUnicos(
          dados
            .filter(
              (item) =>
                Boolean(
                  limparTexto(
                    item.empresa_inspecao,
                  ),
                ),
            )
            .map(
              (item) =>
                item.empresa_inspecao,
            ),
        );
      },
      [
        dados,
        aba,
      ],
    );
  const dadosFiltrados =
    useMemo(
      () => {
        return dados.filter(
          (
            item,
          ) => {
            const data =
              extrairData(
                item.data_inspecao,
              );

            if (
              ano !==
                "TODOS" &&
              String(
                data?.getFullYear() ??
                  "",
              ) !==
                ano
            ) {
              return false;
            }

            if (
              mes !==
                "TODOS" &&
              String(
                (
                  data?.getMonth() ??
                  -1
                ) + 1,
              ) !== mes
            ) {
              return false;
            }

            if (
              colaborador !==
                "TODOS" &&
              item.nome_exibicao !==
                colaborador
            ) {
              return false;
            }

            if (
              setor !==
                "TODOS" &&
              item.setor_colaborador !==
                setor
            ) {
              return false;
            }

            if (
              local !==
                "TODOS" &&
              item.local !==
                local
            ) {
              return false;
            }

            if (
              contrato !==
                "TODOS" &&
              limparTexto(
                item.contrato,
              ) !==
                contrato
            ) {
              return false;
            }

            if (
              formulario !==
                "TODOS" &&
              item.nome_formulario !==
                formulario
            ) {
              return false;
            }

            if (
              empresa !==
                "TODOS" &&
              limparTexto(
                item.empresa_inspecao,
              ) !==
                empresa
            ) {
              return false;
            }

            return true;
          },
        );
      },
      [
        dados,
        ano,
        mes,
        colaborador,
        setor,
        local,
        contrato,
        formulario,
        empresa,
      ],
    );

  const seguranca =
    useMemo(
      () =>
        dadosFiltrados.filter(
          (item) =>
            item.setor_colaborador ===
              SETOR_SEGURANCA &&
            !Boolean(
              limparTexto(
                item.empresa_inspecao,
              ),
            ),
        ),
      [
        dadosFiltrados,
      ],
    );

  const outrasAreas =
    useMemo(
      () =>
        dadosFiltrados.filter(
          (item) =>
            limparTexto(
              item.setor_colaborador,
            ) &&
            item.setor_colaborador !==
              SETOR_SEGURANCA &&
            !Boolean(
              limparTexto(
                item.empresa_inspecao,
              ),
            ),
        ),
      [
        dadosFiltrados,
      ],
    );

  const terceiras =
    useMemo(
      () =>
        dadosFiltrados.filter(
          (item) =>
            Boolean(
              limparTexto(
                item.empresa_inspecao,
              ),
            ),
        ),
      [
        dadosFiltrados,
      ],
    );

  const dadosDaAba =
    useMemo(
      () => {
        if (
          aba ===
          "SEGURANCA"
        ) {
          return seguranca;
        }

        if (
          aba ===
          "OUTRAS"
        ) {
          return outrasAreas;
        }

        if (
          aba ===
          "TERCEIRAS"
        ) {
          return terceiras;
        }

        return dadosFiltrados;
      },
      [
        aba,
        dadosFiltrados,
        seguranca,
        outrasAreas,
        terceiras,
      ],
    );

  const serieTemporal =
    useMemo(
      () => {
        const mapa =
          new Map<
            string,
            number
          >();

        const datas =
          dadosDaAba
            .map(
              (item) =>
                extrairData(
                  item.data_inspecao,
                ),
            )
            .filter(
              (data): data is Date =>
                data !== null,
            )
            .sort(
              (a, b) =>
                a.getTime() -
                b.getTime(),
            );

        if (
          datas.length === 0
        ) {
          return [];
        }

        dadosDaAba.forEach(
          (item) => {
            const data =
              extrairData(
                item.data_inspecao,
              );

            if (!data) {
              return;
            }

            const chave =
              `${data.getFullYear()}-${String(
                data.getMonth() + 1,
              ).padStart(
                2,
                "0",
              )}`;

            mapa.set(
              chave,
              (
                mapa.get(
                  chave,
                ) ?? 0
              ) + 1,
            );
          },
        );

        const primeira =
          datas[0];

        const ultima =
          datas[
            datas.length - 1
          ];

        const cursor =
          new Date(
            primeira.getFullYear(),
            primeira.getMonth(),
            1,
          );

        const limite =
          new Date(
            ultima.getFullYear(),
            ultima.getMonth(),
            1,
          );

        const resultado:
          Array<
            [
              string,
              number,
            ]
          > = [];

        while (
          cursor <= limite
        ) {
          const chave =
            `${cursor.getFullYear()}-${String(
              cursor.getMonth() + 1,
            ).padStart(
              2,
              "0",
            )}`;

          resultado.push(
            [
              chave,
              mapa.get(
                chave,
              ) ?? 0,
            ],
          );

          cursor.setMonth(
            cursor.getMonth() + 1,
          );
        }

        return resultado;
      },
      [
        dadosDaAba,
      ],
    );

  const rankingQuem =
    useMemo(
      () =>
        contarPor(
          dadosDaAba,
          (item) =>
            item.nome_exibicao,
        ).slice(
          0,
          7,
        ),
      [
        dadosDaAba,
      ],
    );

  const rankingOnde =
    useMemo(
      () =>
        contarPor(
          dadosDaAba,
          (item) =>
            item.local,
        ).slice(
          0,
          7,
        ),
      [
        dadosDaAba,
      ],
    );

  const statusPlano =
    useMemo(
      () =>
        contarPor(
          dadosDaAba,
          (item) =>
            labelPlano(
              item.estado_plano_acao,
            ),
        ),
      [
        dadosDaAba,
      ],
    );

  const opcoesMes: ApexOptions = {
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

    legend: {
      show: false,
    },

    grid: {
      borderColor:
        "#E5E7EB",
    },

    plotOptions: {
      bar: {
        borderRadius: 4,
        columnWidth: "55%",
      },
    },

    xaxis: {
      categories:
        serieTemporal.map(
          ([chave]) => {
            const [
              anoValor,
              mesValor,
            ] =
              chave.split("-");

            return `${MESES[
              Number(
                mesValor,
              ) - 1
            ]}/${anoValor.slice(
              -2,
            )}`;
          },
        ),

      labels: {
        rotate: -45,
        rotateAlways: true,
        hideOverlappingLabels: false,
        showDuplicates: true,
        trim: false,
        maxHeight: 80,

        style: {
          colors:
            "#6B7280",
          fontSize:
            "10px",
        },
      },
    },

    yaxis: {
      labels: {
        formatter: (
          valor,
        ) =>
          Number.isInteger(
            valor,
          )
            ? String(
                valor,
              )
            : "",

        style: {
          colors:
            "#6B7280",
        },
      },
    },

    tooltip: {
      theme: "light",

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
  const opcoesQuem: ApexOptions = {
    chart: {
      toolbar: {
        show: false,
      },
      fontFamily:
        "inherit",
    },
    colors: [
  "#1D4ED8", // azul
  "#F97316", // laranja
  "#16A34A", // verde
  "#DC2626", // vermelho
  "#7C3AED", // violeta
  "#0891B2", // ciano
  "#CA8A04", // dourado
  "#BE185D", // rosa
  "#0F766E", // verde petroleo
  "#9333EA", // roxo
  "#65A30D", // lima
  "#92400E", // marrom
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
        rankingQuem.map(
          ([nome]) =>
            nome,
        ),
      labels: {
        formatter: (valor) => {
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

  const opcoesOnde: ApexOptions = {
    chart: {
      toolbar: {
        show: false,
      },
      fontFamily:
        "inherit",
    },
    colors: [
  "#1D4ED8", // azul
  "#F97316", // laranja
  "#16A34A", // verde
  "#DC2626", // vermelho
  "#7C3AED", // violeta
  "#0891B2", // ciano
  "#CA8A04", // dourado
  "#BE185D", // rosa
  "#0F766E", // verde petroleo
  "#9333EA", // roxo
  "#65A30D", // lima
  "#92400E", // marrom
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
        rankingOnde.map(
          (
            [
              nome,
            ],
          ) =>
            nome,
        ),
    },
    grid: {
      borderColor:
        "#E5E7EB",
    },
  };

  const opcoesPlano: ApexOptions = {
    chart: {
      fontFamily:
        "inherit",
    },
    labels:
      statusPlano.map(
        (
          [
            status,
          ],
        ) =>
          status,
      ),
    colors: [
  "#1D4ED8", // azul
  "#F97316", // laranja
  "#16A34A", // verde
  "#DC2626", // vermelho
  "#7C3AED", // violeta
  "#0891B2", // ciano
  "#CA8A04", // dourado
  "#BE185D", // rosa
  "#0F766E", // verde petroleo
  "#9333EA", // roxo
  "#65A30D", // lima
  "#92400E", // marrom
],
    legend: {
      position:
        "bottom",
    },
    dataLabels: {
      enabled: false,
    },
  };

  function selecionarAba(
    novaAba: Aba,
  ) {
    setAba(
      novaAba,
    );

    setSetor(
      "TODOS",
    );

    setColaborador(
      "TODOS",
    );

    setEmpresa(
      "TODOS",
    );
  }
  function limparFiltros() {
    setAno(
      "TODOS",
    );
    setMes(
      "TODOS",
    );
    setColaborador(
      "TODOS",
    );
    setSetor(
      "TODOS",
    );
    setLocal(
      "TODOS",
    );
    setContrato(
      "TODOS",
    );
    setFormulario(
      "TODOS",
    );
    setEmpresa(
      "TODOS",
    );
  }

  if (
    carregando
  ) {
    return (
      <div className="flex min-h-[400px] items-center justify-center text-sm text-gray-500">
        Carregando dados de Inspeções...
      </div>
    );
  }

  if (
    erro
  ) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        {erro}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-gray-500">
          Consultas / Painel Gerencial
        </p>

        <h1 className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">
          Painel de Inspeções
        </h1>

        <p className="mt-1 text-sm text-gray-500">
          Acompanhe e analise as inspeções realizadas,
          com foco em quem, quando e onde.
        </p>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            Filtros
          </h2>

          <button
            onClick={
              limparFiltros
            }
            className="text-xs font-medium text-blue-600 hover:text-blue-700"
          >
            Limpar filtros
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
          <FiltroSelect
            label="Ano"
            value={
              ano
            }
            onChange={
              setAno
            }
            opcoes={
              anos
            }
          />

          <FiltroMes
            value={
              mes
            }
            onChange={
              setMes
            }
          />

          <FiltroSelect
            label="Quem"
            value={
              colaborador
            }
            onChange={
              setColaborador
            }
            opcoes={
              colaboradores
            }
          />

          <FiltroSelect
            label="Área"
            value={
              setor
            }
            onChange={(valor) => {
              setSetor(valor);
              setColaborador("TODOS");
            }}
            opcoes={
              setores
            }
          />

          <FiltroSelect
            label="Onde"
            value={
              local
            }
            onChange={
              setLocal
            }
            opcoes={
              locais
            }
          />

          <FiltroSelect
            label="Contrato"
            value={
              contrato
            }
            onChange={
              setContrato
            }
            opcoes={
              contratos
            }
          />

          <FiltroSelect
            label="Formulário"
            value={
              formulario
            }
            onChange={
              setFormulario
            }
            opcoes={
              formularios
            }
          />

          <FiltroSelect
            label="Empresa"
            value={
              empresa
            }
            onChange={
              setEmpresa
            }
            opcoes={
              empresas
            }
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <KpiCard
          titulo="Total de inspeções"
          valor={
            dadosFiltrados.length
          }
        />

        <KpiCard
          titulo="Segurança"
          valor={
            seguranca.length
          }
        />

        <KpiCard
          titulo="Outras áreas"
          valor={
            outrasAreas.length
          }
        />

        <KpiCard
          titulo="Empresas terceiras"
          valor={
            terceiras.length
          }
        />
      </div>

      <div className="border-b border-gray-200">
        <div className="flex gap-7 overflow-x-auto">
          <AbaButton
            label="Visão Geral"
            ativo={
              aba ===
              "GERAL"
            }
            onClick={() =>
              selecionarAba(
                "GERAL",
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
              "OUTRAS"
            }
            onClick={() =>
              selecionarAba(
                "OUTRAS",
              )
            }
          />

          <AbaButton
            label="Empresas Terceiras"
            ativo={
              aba ===
              "TERCEIRAS"
            }
            onClick={() =>
              selecionarAba(
                "TERCEIRAS",
              )
            }
          />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-4">
        <GraficoCard
          titulo="Inspeções por mês"
        >
          <Chart
            type="bar"
            height={
              285
            }
            options={
              opcoesMes
            }
            series={[
              {
                name:
                  "Inspeções",

                data:
                  serieTemporal.map(
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
          />
        </GraficoCard>

        <GraficoCard
          titulo="Quem inspeciona"
        >
          <Chart
            type="bar"
            height={
              285
            }
            options={
              opcoesQuem
            }
            series={[
              {
                name:
                  "Inspeções",
                data:
                  rankingQuem.map(
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
          />
        </GraficoCard>

        <GraficoCard
          titulo="Onde ocorrem"
        >
          <Chart
            type="bar"
            height={
              285
            }
            options={
              opcoesOnde
            }
            series={[
              {
                name:
                  "Inspeções",
                data:
                  rankingOnde.map(
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
          />
        </GraficoCard>

        <GraficoCard
          titulo="Status dos planos de ação"
        >
          <Chart
            type="donut"
            height={
              285
            }
            options={
              opcoesPlano
            }
            series={
              statusPlano.map(
                (
                  [
                    ,
                    quantidade,
                  ],
                ) =>
                  quantidade,
              )
            }
          />
        </GraficoCard>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="border-b border-gray-200 px-5 py-4 dark:border-gray-800">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            Detalhamento das inspeções
          </h2>

          <p className="mt-1 text-xs text-gray-500">
            {dadosDaAba.length} registros encontrados.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1350px] w-full text-left">
            <thead className="bg-gray-50">
              <tr className="text-xs font-medium uppercase tracking-wide text-gray-500">
                <th className="px-4 py-3">
                  Data
                </th>

                <th className="px-4 py-3">
                  Inspetor
                </th>

                <th className="px-4 py-3">
                  Área
                </th>

                <th className="px-4 py-3">
                  Local
                </th>

                <th className="px-4 py-3">
                  Formulário
                </th>

                <th className="px-4 py-3">
                  Empresa
                </th>

                <th className="px-4 py-3">
                  Contrato
                </th>

                <th className="px-4 py-3">
                  Plano de ação
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {dadosDaAba.map(
                (
                  item,
                ) => (
                  <tr
                    key={
                      item.id_resposta
                    }
                    className="text-sm text-gray-700 hover:bg-gray-50/70"
                  >
                    <td className="whitespace-nowrap px-4 py-3">
                      {formatarData(
                        item.data_inspecao,
                      )}
                    </td>

                    <td className="px-4 py-3 font-medium text-gray-900">
                      {item.nome_exibicao}
                    </td>

                    <td className="px-4 py-3">
                      {item.setor_colaborador ||
                        "-"}
                    </td>

                    <td className="px-4 py-3">
                      {item.local ||
                        "-"}
                    </td>

                    <td className="px-4 py-3">
                      {item.nome_formulario}
                    </td>

                    <td className="px-4 py-3">
                      {item.empresa_inspecao ||
                        "-"}
                    </td>

                    <td className="px-4 py-3">
                      {item.contrato ||
                        "-"}
                    </td>

                    <td className="whitespace-nowrap px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${badgePlano(
                          item.estado_plano_acao,
                        )}`}
                      >
                        {labelPlano(
                          item.estado_plano_acao,
                        )}
                      </span>
                    </td>
                  </tr>
                ),
              )}

              {dadosDaAba.length ===
                0 && (
                <tr>
                  <td
                    colSpan={
                      8
                    }
                    className="px-5 py-10 text-center text-sm text-gray-500"
                  >
                    Nenhuma inspeção encontrada para os filtros selecionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
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
  children: React.ReactNode;
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
}: {
  label: string;
  value: string;
  onChange: (
    value: string,
  ) => void;
  opcoes: string[];
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-medium text-gray-600">
        {label}
      </span>

      <select
        value={
          value
        }
        onChange={(
          event,
        ) =>
          onChange(
            event.target.value,
          )
        }
        className="h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
      >
        <option value="TODOS">
          Todos
        </option>

        {opcoes.map(
          (
            opcao,
          ) => (
            <option
              key={
                opcao
              }
              value={
                opcao
              }
            >
              {opcao}
            </option>
          ),
        )}
      </select>
    </label>
  );
}

function FiltroMes({
  value,
  onChange,
}: {
  value: string;
  onChange: (
    value: string,
  ) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-medium text-gray-600">
        Mês
      </span>

      <select
        value={
          value
        }
        onChange={(
          event,
        ) =>
          onChange(
            event.target.value,
          )
        }
        className="h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
      >
        <option value="TODOS">
          Todos
        </option>

        {MESES.map(
          (
            nome,
            indice,
          ) => (
            <option
              key={
                nome
              }
              value={String(
                indice +
                  1,
              )}
            >
              {nome}
            </option>
          ),
        )}
      </select>
    </label>
  );
}












