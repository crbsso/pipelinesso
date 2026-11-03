"use client";

import { useEffect, useMemo, useState } from "react";

type Avcb = {
  projeto: string;
  subestacao: string;
  localidade: string;
  estado: string;
  responsavel: string;
  empresa: string;
  instalacao: string;
  gestao_avcb: string;
  responsabilidade_avcb: string;
  situacao: string;
  projeto_incendio: string;
  alvara_bombeiros: string;
  sdai: string;
  brigada_incendio: string;
  validade_avcb_uf_anos: number;
  vigencia_alvara: string;
  dias_para_vencer: number;
  status_validade: string;
  status_gestao: string;
  data_atualizacao: string;
};

type Responsabilidade = "CELEO" | "TERCEIROS";

type StatusFiltro =
  | "TODOS"
  | "VENCIDO"
  | "A VENCER"
  | "REGULAR";

function formatarData(data: string) {
  if (!data) return "-";

  const [ano, mes, dia] = data.split("-");

  if (!ano || !mes || !dia) {
    return data;
  }

  return `${dia}/${mes}/${ano}`;
}

function ordenarUnicos(valores: string[]) {
  return Array.from(
    new Set(valores.filter(Boolean)),
  ).sort((a, b) =>
    a.localeCompare(b, "pt-BR"),
  );
}

function badgeStatus(status: string) {
  switch (status) {
    case "REGULAR":
      return "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400";

    case "A VENCER":
      return "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-400";

    case "VENCIDO":
      return "bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-500/10 dark:text-red-400";

    default:
      return "bg-gray-50 text-gray-700 ring-gray-600/20 dark:bg-gray-800 dark:text-gray-300";
  }
}

function badgeGestao(status: string) {
  switch (status) {
    case "ATIVO":
      return "bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-500/10 dark:text-blue-400";

    case "EM ATUALIZAÇÃO":
      return "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-400";

    case "DESATIVADO":
      return "bg-gray-100 text-gray-600 ring-gray-500/20 dark:bg-gray-800 dark:text-gray-400";

    default:
      return "bg-gray-50 text-gray-700 ring-gray-600/20";
  }
}

export default function AvcbPage() {
  const [dados, setDados] = useState<Avcb[]>([]);
  const [carregando, setCarregando] =
    useState(true);
  const [erro, setErro] = useState("");

  const [
    responsabilidade,
    setResponsabilidade,
  ] =
    useState<Responsabilidade>("CELEO");

  const [projeto, setProjeto] =
    useState("TODOS");
  const [estado, setEstado] =
    useState("TODOS");
  const [responsavel, setResponsavel] =
    useState("TODOS");
  const [statusGestao, setStatusGestao] =
    useState("TODOS");

  const [statusFiltro, setStatusFiltro] =
    useState<StatusFiltro>("TODOS");

  useEffect(() => {
    async function carregarDados() {
      try {
        setCarregando(true);
        setErro("");

        const resposta = await fetch(
          "/api/avcb",
          {
            cache: "no-store",
          },
        );

        if (!resposta.ok) {
          throw new Error(
            "Não foi possível consultar os AVCBs.",
          );
        }

        const resultado =
          await resposta.json();

        setDados(resultado.dados ?? []);
      } catch (error) {
        console.error(error);

        setErro(
          "Não foi possível carregar os dados de AVCB.",
        );
      } finally {
        setCarregando(false);
      }
    }

    carregarDados();
  }, []);

  const dadosResponsabilidade =
    useMemo(() => {
      return dados.filter(
        (item) =>
          item.responsabilidade_avcb ===
          responsabilidade,
      );
    }, [dados, responsabilidade]);

  const projetos = useMemo(
    () =>
      ordenarUnicos(
        dadosResponsabilidade.map(
          (item) => item.projeto,
        ),
      ),
    [dadosResponsabilidade],
  );

  const estados = useMemo(
    () =>
      ordenarUnicos(
        dadosResponsabilidade.map(
          (item) => item.estado,
        ),
      ),
    [dadosResponsabilidade],
  );

  const responsaveis = useMemo(
    () =>
      ordenarUnicos(
        dadosResponsabilidade.map(
          (item) => item.responsavel,
        ),
      ),
    [dadosResponsabilidade],
  );

  const statusGestaoOpcoes = useMemo(
    () =>
      ordenarUnicos(
        dadosResponsabilidade.map(
          (item) => item.status_gestao,
        ),
      ),
    [dadosResponsabilidade],
  );

  /*
   * Esses filtros afetam os indicadores.
   * O filtro de status AVCB é aplicado depois
   * apenas à lista operacional.
   */
  const dadosIndicadores = useMemo(() => {
    return dadosResponsabilidade.filter(
      (item) => {
        if (
          projeto !== "TODOS" &&
          item.projeto !== projeto
        ) {
          return false;
        }

        if (
          estado !== "TODOS" &&
          item.estado !== estado
        ) {
          return false;
        }

        if (
          responsavel !== "TODOS" &&
          item.responsavel !== responsavel
        ) {
          return false;
        }

        if (
          statusGestao !== "TODOS" &&
          item.status_gestao !==
            statusGestao
        ) {
          return false;
        }

        return true;
      },
    );
  }, [
    dadosResponsabilidade,
    projeto,
    estado,
    responsavel,
    statusGestao,
  ]);

  const dadosTabela = useMemo(() => {
    if (statusFiltro === "TODOS") {
      return dadosIndicadores;
    }

    return dadosIndicadores.filter(
      (item) =>
        item.status_validade ===
        statusFiltro,
    );
  }, [dadosIndicadores, statusFiltro]);

  const total =
    dadosIndicadores.length;

  const regular =
    dadosIndicadores.filter(
      (item) =>
        item.status_validade ===
        "REGULAR",
    ).length;

  const aVencer =
    dadosIndicadores.filter(
      (item) =>
        item.status_validade ===
        "A VENCER",
    ).length;

  const vencido =
    dadosIndicadores.filter(
      (item) =>
        item.status_validade ===
        "VENCIDO",
    ).length;

  const conformidade =
    total > 0
      ? (regular / total) * 100
      : 0;

  const percentualRegular =
    total > 0
      ? (regular / total) * 100
      : 0;

  const percentualAVencer =
    total > 0
      ? (aVencer / total) * 100
      : 0;

  const percentualVencido =
    total > 0
      ? (vencido / total) * 100
      : 0;

  const ultimaAtualizacao =
    useMemo(() => {
      const datas =
        dados
          .map(
            (item) =>
              item.data_atualizacao,
          )
          .filter(Boolean)
          .sort();

      if (datas.length === 0) {
        return "-";
      }

      return formatarData(
        datas[datas.length - 1],
      );
    }, [dados]);

  function alterarResponsabilidade(
    novaResponsabilidade: Responsabilidade,
  ) {
    setResponsabilidade(
      novaResponsabilidade,
    );

    setProjeto("TODOS");
    setEstado("TODOS");
    setResponsavel("TODOS");
    setStatusGestao("TODOS");
    setStatusFiltro("TODOS");
  }

  function limparFiltros() {
    setProjeto("TODOS");
    setEstado("TODOS");
    setResponsavel("TODOS");
    setStatusGestao("TODOS");
    setStatusFiltro("TODOS");
  }

  if (carregando) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-sm text-gray-500 dark:text-gray-400">
          Carregando dados de AVCB...
        </div>
      </div>
    );
  }

  if (erro) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-400">
        {erro}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* CABEÇALHO */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Consultas / Painel Gerencial
          </p>

          <h1 className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">
            Gestão de AVCB
          </h1>

          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Acompanhamento dos Autos de
            Vistoria do Corpo de
            Bombeiros.
          </p>
        </div>

        <div className="text-xs text-gray-500 dark:text-gray-400">
          Atualização:{" "}
          <span className="font-medium text-gray-700 dark:text-gray-200">
            {ultimaAtualizacao}
          </span>
        </div>
      </div>

      {/* ABAS DE RESPONSABILIDADE */}
      <div className="border-b border-gray-200 dark:border-gray-800">
        <div className="flex gap-8 overflow-x-auto">
          <button
            onClick={() =>
              alterarResponsabilidade(
                "CELEO",
              )
            }
            className={`whitespace-nowrap border-b-2 px-1 pb-3 text-sm font-medium transition ${
              responsabilidade ===
              "CELEO"
                ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            }`}
          >
            Gestão CELEO
          </button>

          <button
            onClick={() =>
              alterarResponsabilidade(
                "TERCEIROS",
              )
            }
            className={`whitespace-nowrap border-b-2 px-1 pb-3 text-sm font-medium transition ${
              responsabilidade ===
              "TERCEIROS"
                ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            }`}
          >
            Gestão Terceiros
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <KpiCard
          titulo="Instalações"
          valor={total}
          destaque="neutral"
        />

        <KpiCard
          titulo="Regular"
          valor={regular}
          destaque="green"
        />

        <KpiCard
          titulo="A vencer"
          valor={aVencer}
          destaque="amber"
        />

        <KpiCard
          titulo="Vencido"
          valor={vencido}
          destaque="red"
        />

        <div className="col-span-2 md:col-span-1">
          <KpiCard
            titulo="Conformidade"
            valor={`${conformidade.toFixed(
              1,
            )}%`}
            destaque={
              conformidade >= 80
                ? "green"
                : conformidade >= 60
                  ? "amber"
                  : "red"
            }
          />
        </div>
      </div>

      {/* DISTRIBUIÇÃO */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            Distribuição por status
          </h2>

          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Situação atual dos AVCBs
            selecionados.
          </p>
        </div>

        <div className="mt-6 space-y-5">
          <BarraStatus
            label="Regular"
            quantidade={regular}
            percentual={
              percentualRegular
            }
            cor="bg-emerald-500"
          />

          <BarraStatus
            label="A vencer"
            quantidade={aVencer}
            percentual={
              percentualAVencer
            }
            cor="bg-amber-500"
          />

          <BarraStatus
            label="Vencido"
            quantidade={vencido}
            percentual={
              percentualVencido
            }
            cor="bg-red-500"
          />
        </div>

        <div className="mt-5 border-t border-gray-100 pt-4 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
          Critério de “A Vencer”:
          AVCBs com vencimento nos
          próximos 90 dias.
        </div>
      </div>

      {/* FILTROS */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            Filtros
          </h2>

          <button
            onClick={limparFiltros}
            className="text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
          >
            Limpar filtros
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <FiltroSelect
            label="Projeto"
            value={projeto}
            onChange={setProjeto}
            opcoes={projetos}
          />

          <FiltroSelect
            label="UF"
            value={estado}
            onChange={setEstado}
            opcoes={estados}
          />

          <FiltroSelect
            label="Responsável"
            value={responsavel}
            onChange={setResponsavel}
            opcoes={responsaveis}
          />

          <FiltroSelect
            label="Status de gestão"
            value={statusGestao}
            onChange={setStatusGestao}
            opcoes={
              statusGestaoOpcoes
            }
          />
        </div>

        <div className="mt-5 border-t border-gray-100 pt-4 dark:border-gray-800">
          <p className="mb-3 text-xs font-medium text-gray-700 dark:text-gray-300">
            Status do AVCB
          </p>

          <div className="flex flex-wrap gap-2">
            <StatusButton
              label="Todos"
              ativo={
                statusFiltro ===
                "TODOS"
              }
              onClick={() =>
                setStatusFiltro("TODOS")
              }
            />

            <StatusButton
              label="Vencido"
              ativo={
                statusFiltro ===
                "VENCIDO"
              }
              onClick={() =>
                setStatusFiltro(
                  "VENCIDO",
                )
              }
            />

            <StatusButton
              label="A vencer"
              ativo={
                statusFiltro ===
                "A VENCER"
              }
              onClick={() =>
                setStatusFiltro(
                  "A VENCER",
                )
              }
            />

            <StatusButton
              label="Regular"
              ativo={
                statusFiltro ===
                "REGULAR"
              }
              onClick={() =>
                setStatusFiltro(
                  "REGULAR",
                )
              }
            />
          </div>
        </div>
      </div>

      {/* TABELA */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="flex flex-col gap-2 border-b border-gray-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-gray-800">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              Detalhamento dos AVCBs
            </h2>

            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {dadosTabela.length}{" "}
              registro
              {dadosTabela.length === 1
                ? ""
                : "s"}{" "}
              encontrado
              {dadosTabela.length === 1
                ? ""
                : "s"}
              .
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1100px] w-full text-left">
            <thead className="bg-gray-50 dark:bg-white/[0.02]">
              <tr className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                <th className="px-5 py-3">
                  Projeto
                </th>

                <th className="px-5 py-3">
                  Subestação
                </th>

                <th className="px-5 py-3">
                  UF
                </th>

                <th className="px-5 py-3">
                  Responsável
                </th>

                <th className="px-5 py-3">
                  Gestão
                </th>

                <th className="px-5 py-3">
                  Vigência
                </th>

                <th className="px-5 py-3">
                  Dias
                </th>

                <th className="px-5 py-3">
                  Status
                </th>

                <th className="px-5 py-3">
                  Status gestão
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {dadosTabela.map(
                (item, index) => (
                  <tr
                    key={`${item.projeto}-${item.subestacao}-${index}`}
                    className="text-sm text-gray-700 hover:bg-gray-50/70 dark:text-gray-300 dark:hover:bg-white/[0.02]"
                  >
                    <td className="whitespace-nowrap px-5 py-4 font-medium text-gray-900 dark:text-white">
                      {item.projeto}
                    </td>

                    <td className="px-5 py-4">
                      {item.subestacao}
                    </td>

                    <td className="whitespace-nowrap px-5 py-4">
                      {item.estado}
                    </td>

                    <td className="px-5 py-4">
                      {item.responsavel}
                    </td>

                    <td className="whitespace-nowrap px-5 py-4">
                      {item.gestao_avcb}
                    </td>

                    <td className="whitespace-nowrap px-5 py-4">
                      {formatarData(
                        item.vigencia_alvara,
                      )}
                    </td>

                    <td className="whitespace-nowrap px-5 py-4">
                      {item.dias_para_vencer}
                    </td>

                    <td className="whitespace-nowrap px-5 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${badgeStatus(
                          item.status_validade,
                        )}`}
                      >
                        {
                          item.status_validade
                        }
                      </span>
                    </td>

                    <td className="whitespace-nowrap px-5 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${badgeGestao(
                          item.status_gestao,
                        )}`}
                      >
                        {
                          item.status_gestao
                        }
                      </span>
                    </td>
                  </tr>
                ),
              )}

              {dadosTabela.length ===
                0 && (
                <tr>
                  <td
                    colSpan={9}
                    className="px-5 py-10 text-center text-sm text-gray-500 dark:text-gray-400"
                  >
                    Nenhum AVCB
                    encontrado para os
                    filtros selecionados.
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
  destaque,
}: {
  titulo: string;
  valor: number | string;
  destaque:
    | "neutral"
    | "green"
    | "amber"
    | "red";
}) {
  const estilos = {
    neutral:
      "border-gray-200 dark:border-gray-800",
    green:
      "border-emerald-200 dark:border-emerald-900/50",
    amber:
      "border-amber-200 dark:border-amber-900/50",
    red:
      "border-red-200 dark:border-red-900/50",
  };

  const valorEstilos = {
    neutral:
      "text-gray-900 dark:text-white",
    green:
      "text-emerald-700 dark:text-emerald-400",
    amber:
      "text-amber-700 dark:text-amber-400",
    red:
      "text-red-700 dark:text-red-400",
  };

  return (
    <div
      className={`h-full rounded-2xl border bg-white p-4 shadow-sm dark:bg-white/[0.03] ${estilos[destaque]}`}
    >
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
        {titulo}
      </p>

      <p
        className={`mt-2 text-2xl font-semibold ${valorEstilos[destaque]}`}
      >
        {valor}
      </p>
    </div>
  );
}

function StatusButton({
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
      onClick={onClick}
      className={`rounded-lg border px-3 py-2 text-xs font-medium transition ${
        ativo
          ? "border-blue-600 bg-blue-600 text-white"
          : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
      }`}
    >
      {label}
    </button>
  );
}

function BarraStatus({
  label,
  quantidade,
  percentual,
  cor,
}: {
  label: string;
  quantidade: number;
  percentual: number;
  cor: string;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-4">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </span>

        <span className="text-xs text-gray-500 dark:text-gray-400">
          {quantidade} (
          {percentual.toFixed(1)}%)
        </span>
      </div>

      <div className="h-2.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
        <div
          className={`h-full rounded-full ${cor}`}
          style={{
            width: `${percentual}%`,
          }}
        />
      </div>
    </div>
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
  onChange: (value: string) => void;
  opcoes: string[];
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-medium text-gray-600 dark:text-gray-400">
        {label}
      </span>

      <select
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        className="h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
      >
        <option value="TODOS">
          Todos
        </option>

        {opcoes.map((opcao) => (
          <option
            key={opcao}
            value={opcao}
          >
            {opcao}
          </option>
        ))}
      </select>
    </label>
  );
}