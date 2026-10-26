"use client";

import VelocidadeMotoristas from "./VelocidadeMotoristas";
import DirecaoMotoristas from "./DirecaoMotoristas";
import HistoricoMotoristas from "./HistoricoMotoristas";

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


// SSO_RANKING_SEGURANCA_VALIDACAO_V1
const RANKING_SEGURANCA_APROVADO = false;

type Aba =
  | "GERAL"
  | "CADASTRO"
  | "USO"
  | "CONDUTORES"
  | "VELOCIDADE"
  | "DIRECAO"
  | "HISTORICO";




type Motorista = {
  nome_exibicao: string;
  coligada: string;
  secao_rm: string;
  situacao_motorista: string;
  situacao_exibicao: string;
  status_cobli: string;
  status_rm: string;
};


type Resumo = {
  grupo: string;
  indicador: string;
  valor: number;
  unidade: string;
};


type Coligada = {
  coligada: string;
  motoristas: number;
  ativos_rm: number;
  a_desabilitar: number;
  sem_identidade_rm: number;
};


type Viagem = {
  data_evento: string;
  ano_evento: number;
  mes_evento: number;
  inicio: string;
  fim: string;
  nome_exibicao: string;
  coligada: string;
  secao_rm: string;
  situacao_motorista: string;
  status_identificacao_condutor: string;
  tipo_registro: string;
  fim_de_semana: boolean;
  noturno: boolean;
  fim_semana_noturno: boolean;
  distancia_km: number;
  duracao_viagem_min: number;
  marcha_lenta_min: number;
};


type UsoSetor = {
  cenario: string;
  secao_rm: string;
  viagens: number;
  km: number;
  motoristas: number;
};


type PendenciaCondutor = {
  cenario: string;
  tipo_registro: string;
  viagens: number;
  km: number;
  registros_cobli: number;
};


type Seguranca = {
  nome_exibicao: string;
  coligada: string;
  secao_rm: string;
  distancia_km: number;
  tempo_dirigido_min: number;
  velocidade_via_eventos_qtd: number;
  aceleracao_brusca_qtd: number;
  frenagem_brusca_qtd: number;
  curva_brusca_qtd: number;
  direcao_distraida_qtd: number;
  uso_celular_qtd: number;
  olhos_fechados_qtd: number;
  bocejo_qtd: number;
  fumo_qtd: number;
  distancia_insegura_qtd: number;
  eventos_risco_total: number;
  taxa_eventos_100km: number;
  elegivel_ranking: boolean;
};


type RankingUso = {
  posicao: number;
  nome_exibicao: string;
  coligada: string;
  secao_rm: string;
  distancia_km: number;
  viagens: number;
};


type RankingSeguranca = {
  posicao: number;
  ranking: string;
  nome_exibicao: string;
  coligada: string;
  secao_rm: string;
  distancia_km: number;
  eventos_risco_total: number;
  taxa_eventos_100km: number;
};


type DadosApi = {
  motoristas: Motorista[];
  resumo: Resumo[];
  coligadas: Coligada[];
  viagens: Viagem[];
  uso_setor: UsoSetor[];
  pendencias_condutor: PendenciaCondutor[];
  seguranca: Seguranca[];
  ranking_uso: RankingUso[];
  ranking_seguranca: RankingSeguranca[];
};


function numero(
  valor:
    | number
    | string
    | null
    | undefined,
) {
  const convertido =
    Number(valor ?? 0);

  return Number.isFinite(
    convertido,
  )
    ? convertido
    : 0;
}


function formatarNumero(
  valor: number,
  casas = 0,
) {
  return new Intl.NumberFormat(
    "pt-BR",
    {
      minimumFractionDigits:
        casas,
      maximumFractionDigits:
        casas,
    },
  ).format(
    numero(valor),
  );
}


function formatarKm(
  valor: number,
) {
  return `${formatarNumero(
    valor,
    1,
  )} km`;
}


function ordenarUnicos(
  valores: Array<
    string | null | undefined
  >,
) {
  return Array.from(
    new Set(
      valores
        .map(
          (valor) =>
            String(
              valor ?? "",
            ).trim(),
        )
        .filter(Boolean),
    ),
  ).sort(
    (a, b) =>
      a.localeCompare(
        b,
        "pt-BR",
      ),
  );
}


function badgeSituacao(
  valor: string,
) {
  const texto =
    String(
      valor ?? "",
    ).toUpperCase();

  // Prioridade: situacoes criticas antes de ATIV.
  if (texto.includes("PENDENTE DE DESATIV")) {
    return "bg-red-50 text-red-700 ring-red-600/20";
  }

  if (
    texto.includes("SEM IDENTIDADE RM") ||
    texto.includes("SEM_IDENTIDADE_RM")
  ) {
    return "bg-amber-50 text-amber-800 ring-amber-600/20";
  }

  if (
    texto.includes(
      "ATIV",
    ) ||
    texto.includes(
      "REGULAR",
    )
  ) {
    return "bg-emerald-50 text-emerald-700 ring-emerald-600/20";
  }

  if (
    texto.includes(
      "DESATIV",
    ) ||
    texto.includes(
      "DEMIT",
    )
  ) {
    return "bg-red-50 text-red-700 ring-red-600/20";
  }

  if (
    texto.includes(
      "REVIS",
    ) ||
    texto.includes(
      "PEND",
    )
  ) {
    return "bg-amber-50 text-amber-700 ring-amber-600/20";
  }

  return "bg-gray-50 text-gray-600 ring-gray-500/20";
}


export default function MotoristasPage() {
  const [
    dados,
    setDados,
  ] =
    useState<DadosApi>({
      motoristas: [],
      resumo: [],
      coligadas: [],
      viagens: [],
      uso_setor: [],
      pendencias_condutor: [],
      seguranca: [],
      ranking_uso: [],
      ranking_seguranca: [],
    });

  const [
    carregando,
    setCarregando,
  ] =
    useState(true);

  const [
    erro,
    setErro,
  ] =
    useState("");

  const [
    aba,
    setAba,
  ] =
    useState<Aba>("GERAL");

  const [
    coligada,
    setColigada,
  ] =
    useState("TODOS");

  const [
    secao,
    setSecao,
  ] =
    useState("TODOS");


  function selecionarAba(
    novaAba: Aba,
  ) {
    setAba(
      novaAba,
    );
  }


  useEffect(
    () => {
      async function carregarDados() {
        try {
          setCarregando(true);
          setErro("");

          const resposta =
            await fetch(
              "/api/motoristas",
              {
                cache:
                  "no-store",
              },
            );

          if (
            !resposta.ok
          ) {
            throw new Error(
              "Falha ao consultar Motoristas.",
            );
          }

          const resultado =
            await resposta.json();

          setDados({
            motoristas:
              resultado?.dados
                ?.motoristas ??
              [],

            resumo:
              resultado?.dados
                ?.resumo ??
              [],

            coligadas:
              resultado?.dados
                ?.coligadas ??
              [],

            viagens:
              resultado?.dados
                ?.viagens ??
              [],

            uso_setor:
              resultado?.dados
                ?.uso_setor ??
              [],

            pendencias_condutor:
              resultado?.dados
                ?.pendencias_condutor ??
              [],

            seguranca:
              resultado?.dados
                ?.seguranca ??
              [],

            ranking_uso:
              resultado?.dados
                ?.ranking_uso ??
              [],

            ranking_seguranca:
              resultado?.dados
                ?.ranking_seguranca ??
              [],
          });
        } catch (
          error
        ) {
          console.error(
            error,
          );

          setErro(
            "Não foi possível carregar os dados de Motoristas.",
          );
        } finally {
          setCarregando(
            false,
          );
        }
      }

      carregarDados();
    },
    [],
  );


  const coligadas =
    useMemo(
      () =>
        ordenarUnicos(
          dados.motoristas.map(
            (item) =>
              item.coligada,
          ),
        ),
      [dados.motoristas],
    );


  const secoes =
    useMemo(
      () =>
        ordenarUnicos(
          dados.motoristas.map(
            (item) =>
              item.secao_rm,
          ),
        ),
      [dados.motoristas],
    );


  const motoristasFiltrados =
    useMemo(
      () =>
        dados.motoristas.filter(
          (item) => {
            if (
              coligada !==
                "TODOS" &&
              item.coligada !==
                coligada
            ) {
              return false;
            }

            if (
              secao !==
                "TODOS" &&
              item.secao_rm !==
                secao
            ) {
              return false;
            }

            return true;
          },
        ),
      [
        dados.motoristas,
        coligada,
        secao,
      ],
    );


  const viagensFiltradas =
    useMemo(
      () =>
        dados.viagens.filter(
          (item) => {
            if (
              coligada !==
                "TODOS" &&
              item.coligada !==
                coligada
            ) {
              return false;
            }

            if (
              secao !==
                "TODOS" &&
              item.secao_rm !==
                secao
            ) {
              return false;
            }

            return true;
          },
        ),
      [
        dados.viagens,
        coligada,
        secao,
      ],
    );


  const segurancaFiltrada =
    useMemo(
      () =>
        dados.seguranca.filter(
          (item) => {
            if (
              coligada !==
                "TODOS" &&
              item.coligada !==
                coligada
            ) {
              return false;
            }

            if (
              secao !==
                "TODOS" &&
              item.secao_rm !==
                secao
            ) {
              return false;
            }

            return true;
          },
        ),
      [
        dados.seguranca,
        coligada,
        secao,
      ],
    );


  const rankingUso =
    useMemo(
      () => {
        const agrupado =
          new Map<
            string,
            RankingUso
          >();

        viagensFiltradas.forEach(
          (item) => {
            const nome =
              String(
                item.nome_exibicao ??
                  "",
              ).trim();

            if (!nome) {
              return;
            }

            const coligadaItem =
              String(
                item.coligada ??
                  "",
              ).trim();

            const secaoItem =
              String(
                item.secao_rm ??
                  "",
              ).trim();

            const chave =
              [
                nome,
                coligadaItem,
                secaoItem,
              ].join(
                "||",
              );

            const atual =
              agrupado.get(
                chave,
              ) ?? {
                posicao: 0,
                nome_exibicao:
                  nome,
                coligada:
                  coligadaItem,
                secao_rm:
                  secaoItem,
                distancia_km: 0,
                viagens: 0,
              };

            atual.distancia_km +=
              numero(
                item.distancia_km,
              );

            atual.viagens +=
              1;

            agrupado.set(
              chave,
              atual,
            );
          },
        );

        return Array.from(
          agrupado.values(),
        )
          .sort(
            (a, b) =>
              b.distancia_km -
              a.distancia_km,
          )
          .slice(
            0,
            10,
          )
          .map(
            (
              item,
              indice,
            ) => ({
              ...item,
              posicao:
                indice + 1,
            }),
          );
      },
      [
        viagensFiltradas,
      ],
    );

  const rankingSeguranca =
    useMemo(
      () => {
        const elegiveis =
          segurancaFiltrada.filter(
            (item) =>
              numero(
                item.distancia_km,
              ) >= 100,
          );

        const melhores = [
          ...elegiveis,
        ]
          .sort(
            (a, b) => {
              const diferencaTaxa =
                numero(
                  a.taxa_eventos_100km,
                ) -
                numero(
                  b.taxa_eventos_100km,
                );

              if (
                diferencaTaxa !== 0
              ) {
                return diferencaTaxa;
              }

              return (
                numero(
                  b.distancia_km,
                ) -
                numero(
                  a.distancia_km,
                )
              );
            },
          )
          .slice(
            0,
            5,
          );

        const piores = [
          ...elegiveis,
        ]
          .sort(
            (a, b) => {
              const diferencaTaxa =
                numero(
                  b.taxa_eventos_100km,
                ) -
                numero(
                  a.taxa_eventos_100km,
                );

              if (
                diferencaTaxa !== 0
              ) {
                return diferencaTaxa;
              }

              return (
                numero(
                  b.distancia_km,
                ) -
                numero(
                  a.distancia_km,
                )
              );
            },
          )
          .slice(
            0,
            5,
          );

        function montarRanking(
          base: Seguranca[],
          ranking: string,
        ): RankingSeguranca[] {
          return base.map(
            (
              item,
              indice,
            ) => ({
              posicao:
                indice + 1,

              ranking,

              nome_exibicao:
                item.nome_exibicao,

              coligada:
                item.coligada,

              secao_rm:
                item.secao_rm,

              distancia_km:
                numero(
                  item.distancia_km,
                ),

              eventos_risco_total:
                numero(
                  item.eventos_risco_total,
                ),

              taxa_eventos_100km:
                numero(
                  item.taxa_eventos_100km,
                ),
            }),
          );
        }

        return [
          ...montarRanking(
            melhores,
            "MELHORES",
          ),
          ...montarRanking(
            piores,
            "PIORES",
          ),
        ];
      },
      [
        segurancaFiltrada,
      ],
    );


  const totalViagens =
    viagensFiltradas.length;


  const kmTotal =
    viagensFiltradas.reduce(
      (
        total,
        item,
      ) =>
        total +
        numero(
          item.distancia_km,
        ),
      0,
    );


  const viagensSemCondutor =
    viagensFiltradas.filter(
      (item) =>
        item.status_identificacao_condutor ===
        "SEM_MOTORISTA_IDENTIFICADO",
    ).length;


  const percentualSemCondutor =
    totalViagens > 0
      ? (
          viagensSemCondutor /
          totalViagens
        ) *
        100
      : 0;


  const comEventoRisco =
    segurancaFiltrada.filter(
      (item) =>
        numero(
          item.eventos_risco_total,
        ) > 0,
    ).length;


  const percentualComRisco =
    segurancaFiltrada.length >
    0
      ? (
          comEventoRisco /
          segurancaFiltrada.length
        ) *
        100
      : 0;


  const pendentesDesativacao =
    motoristasFiltrados.filter(
      (item) => {
        const situacao =
          String(
            item.situacao_motorista ??
              "",
          ).toUpperCase();

        return (
          situacao.includes(
            "DESATIV",
          ) ||
          situacao.includes(
            "DEMIT",
          )
        );
      },
    ).length;


  const usoPorSetor =
    useMemo(
      () => {
        const agrupado =
          new Map<
            string,
            {
              secao_rm: string;
              km: number;
            }
          >();

        viagensFiltradas.forEach(
          (item) => {
            if (
              item.status_identificacao_condutor !==
              "IDENTIFICADO_COM_SETOR"
            ) {
              return;
            }

            const secaoItem =
              String(
                item.secao_rm ??
                  "",
              ).trim();

            if (!secaoItem) {
              return;
            }

            const atual =
              agrupado.get(
                secaoItem,
              ) ?? {
                secao_rm:
                  secaoItem,
                km: 0,
              };

            atual.km +=
              numero(
                item.distancia_km,
              );

            agrupado.set(
              secaoItem,
              atual,
            );
          },
        );

        return Array.from(
          agrupado.values(),
        )
          .sort(
            (a, b) =>
              numero(
                b.km,
              ) -
              numero(
                a.km,
              ),
          )
          .slice(
            0,
            10,
          );
      },
      [
        viagensFiltradas,
      ],
    );


  const eventosRisco = [
    {
      nome:
        "Velocidade",
      valor:
        segurancaFiltrada.reduce(
          (
            total,
            item,
          ) =>
            total +
            numero(
              item.velocidade_via_eventos_qtd,
            ),
          0,
        ),
    },
    {
      nome:
        "Aceleração brusca",
      valor:
        segurancaFiltrada.reduce(
          (
            total,
            item,
          ) =>
            total +
            numero(
              item.aceleracao_brusca_qtd,
            ),
          0,
        ),
    },
    {
      nome:
        "Frenagem brusca",
      valor:
        segurancaFiltrada.reduce(
          (
            total,
            item,
          ) =>
            total +
            numero(
              item.frenagem_brusca_qtd,
            ),
          0,
        ),
    },
    {
      nome:
        "Curva brusca",
      valor:
        segurancaFiltrada.reduce(
          (
            total,
            item,
          ) =>
            total +
            numero(
              item.curva_brusca_qtd,
            ),
          0,
        ),
    },
    {
      nome:
        "Direção distraída",
      valor:
        segurancaFiltrada.reduce(
          (
            total,
            item,
          ) =>
            total +
            numero(
              item.direcao_distraida_qtd,
            ),
          0,
        ),
    },
    {
      nome:
        "Uso de celular",
      valor:
        segurancaFiltrada.reduce(
          (
            total,
            item,
          ) =>
            total +
            numero(
              item.uso_celular_qtd,
            ),
          0,
        ),
    },
  ];


  const opcoesUso:
    ApexOptions = {
      chart: {
        toolbar: {
          show: false,
        },
      },

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
          usoPorSetor.map(
            (item) =>
              item.secao_rm ||
              "Sem seção",
          ),
      },

      grid: {
        borderColor:
          "#e5e7eb",
      },

      tooltip: {
        y: {
          formatter: (
            valor,
          ) =>
            `${formatarNumero(
              valor,
              1,
            )} km`,
        },
      },
    };


  const opcoesRanking:
    ApexOptions = {
      chart: {
        toolbar: {
          show: false,
        },
      },

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
          rankingUso.map(
            (item) =>
              item.nome_exibicao,
          ),
      },

      tooltip: {
        y: {
          formatter: (
            valor,
          ) =>
            `${formatarNumero(
              valor,
              1,
            )} km`,
        },
      },

      grid: {
        borderColor:
          "#e5e7eb",
      },
    };


  const opcoesRisco:
    ApexOptions = {
      chart: {
        toolbar: {
          show: false,
        },
      },

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
          eventosRisco.map(
            (item) =>
              item.nome,
          ),
      },

      grid: {
        borderColor:
          "#e5e7eb",
      },
    };


  if (
    carregando
  ) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-gray-500">
          Carregando dados de Motoristas...
        </p>
      </div>
    );
  }


  if (erro && aba !== "HISTORICO" && aba !== "DIRECAO" && aba !== "VELOCIDADE") {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
        <p className="text-sm font-medium text-red-700">
          {erro}
        </p>
        <button
          type="button"
          onClick={() => selecionarAba("HISTORICO")}
          className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
        >
          Abrir Histórico de Viagens
        </button>
        <button
          type="button"
          onClick={() => selecionarAba("DIRECAO")}
          className="ml-2 mt-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
        >
          Abrir Direção Contínua
        </button>
        <button
          type="button"
          onClick={() => selecionarAba("VELOCIDADE")}
          className="ml-2 mt-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
        >
          Abrir Velocidade e Infrações
        </button>
      </div>
    );
  }


  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
          Motoristas
        </h1>

        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Gestão de cadastro, utilização da frota, identificação de condutores e segurança viária.
        </p>
      </div>


      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="grid gap-4 md:grid-cols-2">
          <FiltroSelect
            label="Coligada"
            value={
              coligada
            }
            onChange={
              setColigada
            }
            opcoes={
              coligadas
            }
          />

          <FiltroSelect
            label="Seção"
            value={
              secao
            }
            onChange={
              setSecao
            }
            opcoes={
              secoes
            }
          />
        </div>
      </div>


      <nav
        aria-label="Navegacao principal de Motoristas"
        className="space-y-3"
      >
        <div className="border-b border-gray-200 dark:border-gray-800">
          <div className="flex flex-wrap gap-x-7 gap-y-2">
            <AbaButton
              label="Resumo"
              ativo={aba === "GERAL"}
              onClick={() => selecionarAba("GERAL")}
            />
            <AbaButton
              label="Cadastro e Identificação"
              ativo={aba === "CADASTRO" || aba === "USO"}
              onClick={() => selecionarAba("CADASTRO")}
            />
            <AbaButton
              label="Segurança"
              ativo={
                aba === "CONDUTORES" ||
                aba === "VELOCIDADE" ||
                aba === "DIRECAO"
              }
              onClick={() => selecionarAba("CONDUTORES")}
            />
            <AbaButton
              label="Histórico"
              ativo={aba === "HISTORICO"}
              onClick={() => selecionarAba("HISTORICO")}
            />
          </div>
        </div>

        {(aba === "CADASTRO" || aba === "USO") && (
          <div
            aria-label="Opcoes de Cadastro e Identificacao"
            className="flex flex-wrap gap-x-6 gap-y-2 border-b border-gray-200 pb-2 dark:border-gray-800"
          >
            <AbaButton
              label="Cadastro"
              ativo={aba === "CADASTRO"}
              onClick={() => selecionarAba("CADASTRO")}
            />
            <AbaButton
              label="Uso e Identificação"
              ativo={aba === "USO"}
              onClick={() => selecionarAba("USO")}
            />
          </div>
        )}

        {(aba === "CONDUTORES" ||
          aba === "VELOCIDADE" ||
          aba === "DIRECAO") && (
          <div
            aria-label="Opcoes de Seguranca"
            className="flex flex-wrap gap-x-6 gap-y-2 border-b border-gray-200 pb-2 dark:border-gray-800"
          >
            <AbaButton
              label="Condutores"
              ativo={aba === "CONDUTORES"}
              onClick={() => selecionarAba("CONDUTORES")}
            />
            <AbaButton
              label="Velocidade"
              ativo={aba === "VELOCIDADE"}
              onClick={() => selecionarAba("VELOCIDADE")}
            />
            <AbaButton
              label="Direção contínua"
              ativo={aba === "DIRECAO"}
              onClick={() => selecionarAba("DIRECAO")}
            />
          </div>
        )}
      </nav>

      {aba === "GERAL" && (
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <KpiCard
          titulo="Motoristas"
          valor={
            formatarNumero(
              motoristasFiltrados.length,
            )
          }
        />

        <KpiCard
          titulo="Viagens"
          valor={
            formatarNumero(
              totalViagens,
            )
          }
        />

        <KpiCard
          titulo="Distância percorrida"
          valor={
            formatarKm(
              kmTotal,
            )
          }
        />

        <KpiCard
          titulo="Viagens sem motorista"
          valor={`${formatarNumero(
            percentualSemCondutor,
            1,
          )}%`}
        />
      </div>
      )}

      {aba === "DIRECAO" && (
        <DirecaoMotoristas coligada={coligada} secao={secao} />
      )}

      {aba === "HISTORICO" && (
        <HistoricoMotoristas coligada={coligada} secao={secao} />
      )}

      {aba === "VELOCIDADE" && (
        <VelocidadeMotoristas
          coligada={coligada}
          secao={secao}
        />
      )}

      {aba ===
        "GERAL" && (
        <>
          <div className="grid gap-4 xl:grid-cols-2">
            <GraficoCard
              titulo="Utilização por setor"
            >
              <Chart
                type="bar"
                height={
                  360
                }
                options={
                  opcoesUso
                }
                series={[
                  {
                    name:
                      "Km",
                    data:
                      usoPorSetor.map(
                        (item) =>
                          numero(
                            item.km,
                          ),
                      ),
                  },
                ]}
              />
            </GraficoCard>

            <GraficoCard
              titulo="Motoristas que mais dirigem"
            >
              <Chart
                type="bar"
                height={
                  360
                }
                options={
                  opcoesRanking
                }
                series={[
                  {
                    name:
                      "Km",
                    data:
                      rankingUso.map(
                        (item) =>
                          numero(
                            item.distancia_km,
                          ),
                      ),
                  },
                ]}
              />
            </GraficoCard>
          </div>


          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <KpiCard
              titulo="Pendentes de desativação"
              valor={
                formatarNumero(
                  pendentesDesativacao,
                )
              }
            />

            <KpiCard
              titulo="Motoristas monitorados"
              valor={
                formatarNumero(
                  segurancaFiltrada.length,
                )
              }
            />

            <KpiCard
              titulo="Com evento de risco"
              valor={
                formatarNumero(
                  comEventoRisco,
                )
              }
            />

            <KpiCard
              titulo="% com evento de risco"
              valor={`${formatarNumero(
                percentualComRisco,
                1,
              )}%`}
            />
          </div>
        </>
      )}


      {aba ===
        "CADASTRO" && (
        <>
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-white/[0.03]">
            <div className="border-b border-gray-200 px-5 py-4 dark:border-gray-800">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                Cadastro de motoristas
              </h2>

              <p className="mt-1 text-xs text-gray-500">
                {motoristasFiltrados.length} registros encontrados.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-[1050px] w-full text-left">
                <thead className="bg-gray-50 dark:bg-white/[0.02]">
                  <tr className="text-xs font-medium uppercase tracking-wide text-gray-500">
                    <th className="px-4 py-3">
                      Motorista
                    </th>

                    <th className="px-4 py-3">
                      Coligada
                    </th>

                    <th className="px-4 py-3">
                      Seção
                    </th>

                    <th className="px-4 py-3">
                      Situação
                    </th>

                    <th className="px-4 py-3">
                      Cobli
                    </th>

                    <th className="px-4 py-3">
                      RM
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {motoristasFiltrados.map(
                    (
                      item,
                      indice,
                    ) => (
                      <tr
                        key={`${item.nome_exibicao}-${item.coligada}-${indice}`}
                        className="text-sm text-gray-700 hover:bg-gray-50/70 dark:text-gray-300 dark:hover:bg-white/[0.02]"
                      >
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                          {item.nome_exibicao ||
                            "-"}
                        </td>

                        <td className="px-4 py-3">
                          {item.coligada ||
                            "-"}
                        </td>

                        <td className="px-4 py-3">
                          {item.secao_rm ||
                            "-"}
                        </td>

                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${badgeSituacao(
                              item.situacao_exibicao ||
                                item.situacao_motorista,
                            )}`}
                          >
                            {item.situacao_exibicao ||
                              item.situacao_motorista ||
                              "-"}
                          </span>
                        </td>

                        <td className="px-4 py-3">
                          {item.status_cobli ||
                            "-"}
                        </td>

                        <td className="px-4 py-3">
                          {item.status_rm ||
                            "-"}
                        </td>
                      </tr>
                    ),
                  )}

                  {motoristasFiltrados.length ===
                    0 && (
                    <tr>
                      <td
                        colSpan={
                          6
                        }
                        className="px-5 py-10 text-center text-sm text-gray-500"
                      >
                        Nenhum motorista encontrado para os filtros selecionados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}


      {aba ===
        "USO" && (
        <>
          <div className="grid gap-4 xl:grid-cols-2">
            <GraficoCard
              titulo="Km por setor"
            >
              <Chart
                type="bar"
                height={
                  360
                }
                options={
                  opcoesUso
                }
                series={[
                  {
                    name:
                      "Km",
                    data:
                      usoPorSetor.map(
                        (item) =>
                          numero(
                            item.km,
                          ),
                      ),
                  },
                ]}
              />
            </GraficoCard>

            <GraficoCard
              titulo="Ranking de utilização"
            >
              <Chart
                type="bar"
                height={
                  360
                }
                options={
                  opcoesRanking
                }
                series={[
                  {
                    name:
                      "Km",
                    data:
                      rankingUso.map(
                        (item) =>
                          numero(
                            item.distancia_km,
                          ),
                      ),
                  },
                ]}
              />
            </GraficoCard>
          </div>


          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-white/[0.03]">
            <div className="border-b border-gray-200 px-5 py-4 dark:border-gray-800">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                Pendências de identificação do condutor
              </h2>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-[800px] w-full text-left">
                <thead className="bg-gray-50 dark:bg-white/[0.02]">
                  <tr className="text-xs font-medium uppercase tracking-wide text-gray-500">
                    <th className="px-4 py-3">
                      Cenário
                    </th>

                    <th className="px-4 py-3">
                      Tipo
                    </th>

                    <th className="px-4 py-3">
                      Viagens
                    </th>

                    <th className="px-4 py-3">
                      Km
                    </th>

                    <th className="px-4 py-3">
                      Registros Cobli
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {dados.pendencias_condutor.map(
                    (
                      item,
                      indice,
                    ) => (
                      <tr
                        key={`${item.cenario}-${item.tipo_registro}-${indice}`}
                        className="text-sm text-gray-700 hover:bg-gray-50/70 dark:text-gray-300 dark:hover:bg-white/[0.02]"
                      >
                        <td className="px-4 py-3">
                          {item.cenario ||
                            "-"}
                        </td>

                        <td className="px-4 py-3">
                          {item.tipo_registro ||
                            "-"}
                        </td>

                        <td className="px-4 py-3">
                          {formatarNumero(
                            item.viagens,
                          )}
                        </td>

                        <td className="px-4 py-3">
                          {formatarKm(
                            item.km,
                          )}
                        </td>

                        <td className="px-4 py-3">
                          {formatarNumero(
                            item.registros_cobli,
                          )}
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}


      {aba ===
        "CONDUTORES" && (
        <>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <KpiCard
              titulo="Motoristas monitorados"
              valor={
                formatarNumero(
                  segurancaFiltrada.length,
                )
              }
            />

            <KpiCard
              titulo="Com evento de risco"
              valor={
                formatarNumero(
                  comEventoRisco,
                )
              }
            />

            <KpiCard
              titulo="% com risco"
              valor={`${formatarNumero(
                percentualComRisco,
                1,
              )}%`}
            />

            <KpiCard
              titulo="Elegíveis ≥ 100 km"
              valor={
                formatarNumero(
                  segurancaFiltrada.filter(
                    (item) =>
                      item.elegivel_ranking,
                  ).length,
                )
              }
            />
          </div>


          <GraficoCard
            titulo="Eventos de risco"
          >
            <Chart
              type="bar"
              height={
                360
              }
              options={
                opcoesRisco
              }
              series={[
                {
                  name:
                    "Eventos",
                  data:
                    eventosRisco.map(
                      (item) =>
                        item.valor,
                    ),
                },
              ]}
            />
          </GraficoCard>


          {RANKING_SEGURANCA_APROVADO ? (
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-white/[0.03]">
            <div className="border-b border-gray-200 px-5 py-4 dark:border-gray-800">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                Ranking de segurança
              </h2>

              <p className="mt-1 text-xs text-gray-500">
                Somente motoristas elegíveis conforme a regra do pipeline.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-[950px] w-full text-left">
                <thead className="bg-gray-50 dark:bg-white/[0.02]">
                  <tr className="text-xs font-medium uppercase tracking-wide text-gray-500">
                    <th className="px-4 py-3">
                      Ranking
                    </th>

                    <th className="px-4 py-3">
                      Posição
                    </th>

                    <th className="px-4 py-3">
                      Motorista
                    </th>

                    <th className="px-4 py-3">
                      Coligada
                    </th>

                    <th className="px-4 py-3">
                      Km
                    </th>

                    <th className="px-4 py-3">
                      Eventos
                    </th>

                    <th className="px-4 py-3">
                      Taxa / 100 km
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {rankingSeguranca.map(
                    (
                      item,
                      indice,
                    ) => (
                      <tr
                        key={`${item.ranking}-${item.posicao}-${item.nome_exibicao}-${indice}`}
                        className="text-sm text-gray-700 hover:bg-gray-50/70 dark:text-gray-300 dark:hover:bg-white/[0.02]"
                      >
                        <td className="px-4 py-3 font-medium">
                          {item.ranking ||
                            "-"}
                        </td>

                        <td className="px-4 py-3">
                          {item.posicao}
                        </td>

                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                          {item.nome_exibicao ||
                            "-"}
                        </td>

                        <td className="px-4 py-3">
                          {item.coligada ||
                            "-"}
                        </td>

                        <td className="px-4 py-3">
                          {formatarKm(
                            item.distancia_km,
                          )}
                        </td>

                        <td className="px-4 py-3">
                          {formatarNumero(
                            item.eventos_risco_total,
                          )}
                        </td>

                        <td className="px-4 py-3">
                          {formatarNumero(
                            item.taxa_eventos_100km,
                            2,
                          )}
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          </div>
          ) : (
          <div
            role="status"
            className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-white/[0.03]"
          >
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              Ranking de segurança em validação
            </h2>
            <p className="mt-3 text-sm leading-6 text-gray-700 dark:text-gray-300">
              A classificação dos melhores e piores condutores
              permanece indisponível enquanto os eventos de velocidade
              utilizados no cálculo aguardam validação.
            </p>
            <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
              Os demais indicadores são apresentados para
              análise descritiva e não constituem uma
              classificação definitiva dos condutores.
            </p>
          </div>
          )}
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
  valor:
    | string
    | number;
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
  children:
    React.ReactNode;
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
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (
    value: string,
  ) => void;
  opcoes: string[];
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-medium text-gray-600 dark:text-gray-400">
        {label}
      </span>

      <select
        value={
          value
        }
        disabled={
          disabled
        }
        onChange={(
          event,
        ) =>
          onChange(
            event.target.value,
          )
        }
        className="h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300 dark:disabled:bg-gray-800"
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
