"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";


type Aba =
  | "TODOS"
  | "SEGURANCA"
  | "OUTRAS_AREAS";


type AcaoCorretiva = {
  acao_corretiva_id: string;
  plano_id: string;
  id_resposta: number | null;
  nome_formulario: string | null;
  modulo_origem: string | null;
  data_inicio: string | null;
  prazo: string | null;
  proxima_verificacao: string | null;
  nivel_organizacional: string | null;
  responsavel_exibicao: string | null;
  estado_acao_fonte: string | null;
  estado_aprovacao: string | null;
  flag_ativo_fonte: number;
  dias_para_prazo: number | null;
  dias_em_atraso_calculado: number | null;
  situacao_prazo_calculada: string | null;
  situacao_gerencial: string | null;
  flag_vence_hoje: number;
  grupo_sso: string | null;
};


type RespostaApi = {
  total: number;
  dados: AcaoCorretiva[];
  error?: string;
};


type Props = {
  aba: Aba;
};


function limparTexto(
  valor: string | null | undefined,
) {
  return (valor ?? "").trim();
}


function formatarData(
  valor: string | null,
) {
  if (!valor) {
    return "-";
  }

  const partes =
    valor.split("-");

  if (partes.length !== 3) {
    return valor;
  }

  return (
    partes[2] +
    "/" +
    partes[1] +
    "/" +
    partes[0]
  );
}


function nomeGrupo(
  valor: string | null,
) {
  if (valor === "SEGURANCA") {
    return "Seguran\u00e7a";
  }

  if (valor === "OUTRAS_AREAS") {
    return "Outras \u00c1reas";
  }

  return valor ?? "-";
}


function nomeSituacao(
  valor: string | null,
) {
  switch (valor) {
    case "EM_PRAZO":
      return "Em prazo";

    case "VENCE_HOJE":
      return "Vence hoje";

    case "VENCIDO":
      return "Vencido";

    case "FECHADO":
      return "Fechado";

    case "FECHADO_APOS_PRAZO":
      return "Fechado ap\u00f3s o prazo";

    case "SEM_PRAZO":
      return "Sem prazo";

    default:
      return valor ?? "-";
  }
}


function classeSituacao(
  valor: string | null,
) {
  switch (valor) {
    case "VENCIDO":
      return (
        "bg-red-50 text-red-700 " +
        "dark:bg-red-500/10 dark:text-red-400"
      );

    case "EM_PRAZO":
      return (
        "bg-green-50 text-green-700 " +
        "dark:bg-green-500/10 dark:text-green-400"
      );

    case "VENCE_HOJE":
      return (
        "bg-amber-50 text-amber-700 " +
        "dark:bg-amber-500/10 dark:text-amber-400"
      );

    case "FECHADO":
      return (
        "bg-blue-50 text-blue-700 " +
        "dark:bg-blue-500/10 dark:text-blue-400"
      );

    case "FECHADO_APOS_PRAZO":
      return (
        "bg-orange-50 text-orange-700 " +
        "dark:bg-orange-500/10 dark:text-orange-400"
      );

    default:
      return (
        "bg-gray-100 text-gray-600 " +
        "dark:bg-gray-800 dark:text-gray-300"
      );
  }
}


function ordenarUnicos(
  valores: Array<string | null>,
) {
  return Array.from(
    new Set(
      valores
        .map(
          (valor) =>
            limparTexto(valor),
        )
        .filter(Boolean),
    ),
  ).sort(
    (a, b) =>
      a.localeCompare(
        b,
        "pt-BR",
        {
          sensitivity: "base",
        },
      ),
  );
}


function CardIndicador({
  titulo,
  valor,
}: {
  titulo: string;
  valor: number;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-white/[0.03]">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        {titulo}
      </p>

      <p className="mt-2 text-3xl font-semibold text-gray-900 dark:text-white">
        {valor}
      </p>
    </div>
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
      <span className="mb-1.5 block text-xs font-medium text-gray-600 dark:text-gray-400">
        {label}
      </span>

      <select
        value={value}
        onChange={(
          evento,
        ) =>
          onChange(
            evento.target.value,
          )
        }
        className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 outline-none transition focus:border-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
      >
        <option value="">
          Todos
        </option>

        {opcoes.map(
          (opcao) => (
            <option
              key={opcao}
              value={opcao}
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


export default function AcoesCorretivasPainel({
  aba,
}: Props) {
  const [
    dados,
    setDados,
  ] = useState<
    AcaoCorretiva[]
  >([]);

  const [
    carregando,
    setCarregando,
  ] = useState(true);

  const [
    erro,
    setErro,
  ] = useState<
    string | null
  >(null);

  const [
    busca,
    setBusca,
  ] = useState("");

  const [
    filtroOrigem,
    setFiltroOrigem,
  ] = useState("");

  const [
    filtroResponsavel,
    setFiltroResponsavel,
  ] = useState("");

  const [
    filtroSituacao,
    setFiltroSituacao,
  ] = useState("");

  const [
    filtroAprovacao,
    setFiltroAprovacao,
  ] = useState("");


  useEffect(
    () => {
      setBusca("");
      setFiltroOrigem("");
      setFiltroResponsavel("");
      setFiltroSituacao("");
      setFiltroAprovacao("");
    },
    [
      aba,
    ],
  );


  useEffect(
    () => {
      const controller =
        new AbortController();


      async function carregar() {
        try {
          setCarregando(
            true,
          );

          setErro(
            null,
          );


          const resposta =
            await fetch(
              "/api/acoes-corretivas",
              {
                cache:
                  "no-store",

                signal:
                  controller.signal,
              },
            );


          const resultado =
            (
              await resposta.json()
            ) as RespostaApi;


          if (!resposta.ok) {
            throw new Error(
              resultado.error ??
                "Nao foi possivel carregar as Acoes Corretivas.",
            );
          }


          if (
            !controller
              .signal
              .aborted
          ) {
            setDados(
              resultado.dados ??
                [],
            );
          }

        } catch (error) {
          if (
            controller
              .signal
              .aborted
          ) {
            return;
          }

          setErro(
            error instanceof Error
              ? error.message
              : "Erro inesperado ao carregar as Acoes Corretivas.",
          );

        } finally {
          if (
            !controller
              .signal
              .aborted
          ) {
            setCarregando(
              false,
            );
          }
        }
      }


      carregar();


      return () => {
        controller.abort();
      };
    },
    [],
  );


  const origens =
    useMemo(
      () =>
        ordenarUnicos(
          dados.map(
            (item) =>
              item.modulo_origem,
          ),
        ),
      [dados],
    );


  const responsaveis =
    useMemo(
      () =>
        ordenarUnicos(
          dados
            .filter(
              (item) =>
                aba === "TODOS" ||
                item.grupo_sso === aba,
            )
            .map(
              (item) =>
                item.responsavel_exibicao,
            ),
        ),
      [
        dados,
        aba,
      ],
    );


  const situacoes =
    useMemo(
      () =>
        ordenarUnicos(
          dados.map(
            (item) =>
              item.situacao_gerencial,
          ),
        ),
      [dados],
    );


  const aprovacoes =
    useMemo(
      () =>
        ordenarUnicos(
          dados.map(
            (item) =>
              item.estado_aprovacao,
          ),
        ),
      [dados],
    );


  const dadosFiltrados =
    useMemo(
      () => {
        const buscaNorm =
          busca
            .trim()
            .toLowerCase();


        return dados
          .filter(
            (item) => {
              if (
                aba !==
                  "TODOS" &&
                item.grupo_sso !==
                  aba
              ) {
                return false;
              }


              if (
                filtroOrigem &&
                limparTexto(
                  item.modulo_origem,
                ) !==
                  filtroOrigem
              ) {
                return false;
              }


              if (
                filtroResponsavel &&
                limparTexto(
                  item.responsavel_exibicao,
                ) !==
                  filtroResponsavel
              ) {
                return false;
              }


              if (
                filtroSituacao &&
                limparTexto(
                  item.situacao_gerencial,
                ) !==
                  filtroSituacao
              ) {
                return false;
              }


              if (
                filtroAprovacao &&
                limparTexto(
                  item.estado_aprovacao,
                ) !==
                  filtroAprovacao
              ) {
                return false;
              }


              if (buscaNorm) {
                const alvo = [
                  item
                    .acao_corretiva_id,
                  item.plano_id,
                  item
                    .responsavel_exibicao ??
                    "",
                  item
                    .id_resposta ??
                    "",
                ]
                  .join(" ")
                  .toLowerCase();


                if (
                  !alvo.includes(
                    buscaNorm,
                  )
                ) {
                  return false;
                }
              }


              return true;
            },
          )
          .sort(
            (
              a,
              b,
            ) => {
              const numeroA =
                Number(
                  a.acao_corretiva_id,
                );

              const numeroB =
                Number(
                  b.acao_corretiva_id,
                );


              if (
                Number.isFinite(
                  numeroA,
                ) &&
                Number.isFinite(
                  numeroB,
                )
              ) {
                return (
                  numeroA -
                  numeroB
                );
              }


              return (
                a.acao_corretiva_id
                  .localeCompare(
                    b.acao_corretiva_id,
                  )
              );
            },
          );
      },
      [
        aba,
        busca,
        dados,
        filtroAprovacao,
        filtroOrigem,
        filtroResponsavel,
        filtroSituacao,
      ],
    );


  const indicadores =
    useMemo(
      () => ({
        total:
          dadosFiltrados.length,

        ativas:
          dadosFiltrados.filter(
            (item) =>
              item.flag_ativo_fonte ===
              1,
          ).length,

        vencidas:
          dadosFiltrados.filter(
            (item) =>
              item.situacao_gerencial ===
              "VENCIDO",
          ).length,

        fechadasAposPrazo:
          dadosFiltrados.filter(
            (item) =>
              item.situacao_gerencial ===
              "FECHADO_APOS_PRAZO",
          ).length,
      }),
      [
        dadosFiltrados,
      ],
    );


  function limparFiltros() {
    setBusca("");
    setFiltroOrigem("");
    setFiltroResponsavel("");
    setFiltroSituacao("");
    setFiltroAprovacao("");
  }


  if (carregando) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-500 shadow-sm dark:border-gray-800 dark:bg-white/[0.03]">
        Carregando Acoes Corretivas...
      </div>
    );
  }


  if (erro) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        {erro}
      </div>
    );
  }


  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
              {"Filtros das A\u00e7\u00f5es Corretivas"}
            </h2>

            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {"Busca por ID da a\u00e7\u00e3o, Plano, respons\u00e1vel ou resposta."}
            </p>
          </div>

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


        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-gray-600 dark:text-gray-400">
              Busca
            </span>

            <input
              value={busca}
              onChange={(
                evento,
              ) =>
                setBusca(
                  evento.target.value,
                )
              }
              placeholder="ID, Plano ou responsavel"
              className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 outline-none transition focus:border-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
            />
          </label>


          <FiltroSelect
            label={
              "M\u00f3dulo de origem"
            }
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
            label={
              "Respons\u00e1vel"
            }
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


          <FiltroSelect
            label={
              "Situa\u00e7\u00e3o da a\u00e7\u00e3o"
            }
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
              nomeSituacao
            }
          />


          <FiltroSelect
            label={
              "Estado de aprova\u00e7\u00e3o"
            }
            value={
              filtroAprovacao
            }
            onChange={
              setFiltroAprovacao
            }
            opcoes={
              aprovacoes
            }
          />
        </div>
      </div>


      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <CardIndicador
          titulo={
            "A\u00e7\u00f5es"
          }
          valor={
            indicadores.total
          }
        />

        <CardIndicador
          titulo="Ativas"
          valor={
            indicadores.ativas
          }
        />

        <CardIndicador
          titulo="Vencidas"
          valor={
            indicadores.vencidas
          }
        />

        <CardIndicador
          titulo={
            "Fechadas ap\u00f3s o prazo"
          }
          valor={
            indicadores.fechadasAposPrazo
          }
        />
      </div>


      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="flex items-center justify-between gap-4 border-b border-gray-200 px-5 py-4 dark:border-gray-800">
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
              {"A\u00e7\u00f5es Corretivas"}
            </h2>

            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {dadosFiltrados.length} registro(s)
            </p>
          </div>
        </div>


        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-800">
            <thead className="bg-gray-50 dark:bg-gray-900/40">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">
                  {"A\u00e7\u00e3o"}
                </th>

                <th className="px-4 py-3 text-left font-medium text-gray-500">
                  Plano
                </th>

                <th className="px-4 py-3 text-left font-medium text-gray-500">
                  {"Respons\u00e1vel"}
                </th>

                <th className="px-4 py-3 text-left font-medium text-gray-500">
                  Origem
                </th>

                <th className="px-4 py-3 text-left font-medium text-gray-500">
                  {"In\u00edcio"}
                </th>

                <th className="px-4 py-3 text-left font-medium text-gray-500">
                  Prazo
                </th>

                <th className="px-4 py-3 text-left font-medium text-gray-500">
                  {"Situa\u00e7\u00e3o"}
                </th>

                <th className="px-4 py-3 text-left font-medium text-gray-500">
                  {"Aprova\u00e7\u00e3o"}
                </th>

                <th className="px-4 py-3 text-left font-medium text-gray-500">
                  Grupo
                </th>
              </tr>
            </thead>


            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {dadosFiltrados.map(
                (item) => (
                  <tr
                    key={
                      item.acao_corretiva_id
                    }
                    className="hover:bg-gray-50 dark:hover:bg-white/[0.02]"
                  >
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-gray-900 dark:text-white">
                      {
                        item.acao_corretiva_id
                      }
                    </td>

                    <td className="whitespace-nowrap px-4 py-3 text-gray-600 dark:text-gray-300">
                      {
                        item.plano_id
                      }
                    </td>

                    <td className="min-w-48 px-4 py-3 text-gray-600 dark:text-gray-300">
                      {
                        item.responsavel_exibicao ??
                        "-"
                      }
                    </td>

                    <td className="min-w-48 px-4 py-3 text-gray-600 dark:text-gray-300">
                      {
                        item.modulo_origem ??
                        "-"
                      }
                    </td>

                    <td className="whitespace-nowrap px-4 py-3 text-gray-600 dark:text-gray-300">
                      {
                        formatarData(
                          item.data_inicio,
                        )
                      }
                    </td>

                    <td className="whitespace-nowrap px-4 py-3 text-gray-600 dark:text-gray-300">
                      {
                        formatarData(
                          item.prazo,
                        )
                      }
                    </td>

                    <td className="whitespace-nowrap px-4 py-3">
                      <span
                        className={
                          "inline-flex rounded-full px-2.5 py-1 text-xs font-medium " +
                          classeSituacao(
                            item.situacao_gerencial,
                          )
                        }
                      >
                        {
                          nomeSituacao(
                            item.situacao_gerencial,
                          )
                        }
                      </span>
                    </td>

                    <td className="min-w-40 px-4 py-3 text-gray-600 dark:text-gray-300">
                      {
                        item.estado_aprovacao ??
                        "-"
                      }
                    </td>

                    <td className="whitespace-nowrap px-4 py-3 text-gray-600 dark:text-gray-300">
                      {
                        nomeGrupo(
                          item.grupo_sso,
                        )
                      }
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
                    className="px-4 py-10 text-center text-sm text-gray-500"
                  >
                    {"Nenhuma A\u00e7\u00e3o Corretiva encontrada para os filtros selecionados."}
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
