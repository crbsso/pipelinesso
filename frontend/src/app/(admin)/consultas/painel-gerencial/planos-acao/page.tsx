"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

type PlanoAcao = {
  plano_id: string;
  nome_plano: string | null;
  estado_plano_fonte: string | null;
  cronograma_plano: string | null;
  gestor_plano: string | null;
  grupo_sso: string | null;
  situacao_prazo_calculada: string | null;
};

type RespostaApi = {
  total: number;
  dados: PlanoAcao[];
  error?: string;
};

type FiltroGrupo =
  | "TODOS"
  | "SEGURANCA"
  | "OUTRAS_AREAS";

function normalizar(valor: string | null) {
  return (valor ?? "")
    .trim()
    .toLowerCase();
}

function formatarData(valor: string | null) {
  if (!valor) {
    return "—";
  }

  const partes = valor.split("-");

  if (partes.length !== 3) {
    return valor;
  }

  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function nomeGrupo(valor: string | null) {
  if (valor === "SEGURANCA") {
    return "Segurança";
  }

  if (valor === "OUTRAS_AREAS") {
    return "Outras Áreas";
  }

  return valor ?? "—";
}

export default function PlanosAcaoPage() {
  const [dados, setDados] =
    useState<PlanoAcao[]>([]);

  const [carregando, setCarregando] =
    useState(true);

  const [erro, setErro] =
    useState<string | null>(null);

  const [grupoSelecionado, setGrupoSelecionado] =
    useState<FiltroGrupo>("TODOS");

  useEffect(() => {
    let ativo = true;

    async function carregar() {
      try {
        setCarregando(true);
        setErro(null);

        const resposta = await fetch(
          "/api/planos-acao",
          {
            cache: "no-store",
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
          setDados(resultado.dados ?? []);
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

  const dadosFiltrados = useMemo(() => {
    if (grupoSelecionado === "TODOS") {
      return dados;
    }

    return dados.filter(
      (item) =>
        item.grupo_sso === grupoSelecionado,
    );
  }, [dados, grupoSelecionado]);

  const indicadores = useMemo(() => {
    const aberto = dadosFiltrados.filter(
      (item) =>
        normalizar(
          item.estado_plano_fonte,
        ) === "aberto",
    ).length;

    const atrasado = dadosFiltrados.filter(
      (item) =>
        normalizar(
          item.estado_plano_fonte,
        ) === "atrasado",
    ).length;

    const fechado = dadosFiltrados.filter(
      (item) =>
        normalizar(
          item.estado_plano_fonte,
        ).startsWith("fechado"),
    ).length;

    return {
      total: dadosFiltrados.length,
      aberto,
      atrasado,
      fechado,
    };
  }, [dadosFiltrados]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
          Planos de Ação
        </h1>

        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Acompanhamento dos Planos de Ação do SSO.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() =>
            setGrupoSelecionado("TODOS")
          }
          className={`rounded-lg px-4 py-2 text-sm font-medium ${
            grupoSelecionado === "TODOS"
              ? "bg-blue-600 text-white"
              : "border border-gray-200 bg-white text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
          }`}
        >
          Todos
        </button>

        <button
          type="button"
          onClick={() =>
            setGrupoSelecionado("SEGURANCA")
          }
          className={`rounded-lg px-4 py-2 text-sm font-medium ${
            grupoSelecionado === "SEGURANCA"
              ? "bg-blue-600 text-white"
              : "border border-gray-200 bg-white text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
          }`}
        >
          Segurança
        </button>

        <button
          type="button"
          onClick={() =>
            setGrupoSelecionado(
              "OUTRAS_AREAS",
            )
          }
          className={`rounded-lg px-4 py-2 text-sm font-medium ${
            grupoSelecionado ===
            "OUTRAS_AREAS"
              ? "bg-blue-600 text-white"
              : "border border-gray-200 bg-white text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
          }`}
        >
          Outras Áreas
        </button>
      </div>

      {carregando && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-500 dark:border-gray-800 dark:bg-gray-900">
          Carregando Planos de Ação...
        </div>
      )}

      {erro && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          {erro}
        </div>
      )}

      {!carregando && !erro && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              titulo="Total"
              valor={indicadores.total}
            />

            <KpiCard
              titulo="Abertos"
              valor={indicadores.aberto}
            />

            <KpiCard
              titulo="Atrasados"
              valor={indicadores.atrasado}
            />

            <KpiCard
              titulo="Fechados"
              valor={indicadores.fechado}
            />
          </div>

          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
            <div className="border-b border-gray-200 px-5 py-4 dark:border-gray-800">
              <h2 className="font-semibold text-gray-900 dark:text-white">
                Planos cadastrados
              </h2>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">
                      ID
                    </th>
                    <th className="px-4 py-3 text-left font-medium">
                      Plano
                    </th>
                    <th className="px-4 py-3 text-left font-medium">
                      Grupo
                    </th>
                    <th className="px-4 py-3 text-left font-medium">
                      Estado
                    </th>
                    <th className="px-4 py-3 text-left font-medium">
                      Prazo
                    </th>
                    <th className="px-4 py-3 text-left font-medium">
                      Gestor
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
                        <td className="whitespace-nowrap px-4 py-3">
                          {plano.plano_id}
                        </td>

                        <td className="min-w-72 px-4 py-3">
                          {plano.nome_plano ??
                            "—"}
                        </td>

                        <td className="whitespace-nowrap px-4 py-3">
                          {nomeGrupo(
                            plano.grupo_sso,
                          )}
                        </td>

                        <td className="whitespace-nowrap px-4 py-3">
                          {plano.estado_plano_fonte ??
                            "—"}
                        </td>

                        <td className="whitespace-nowrap px-4 py-3">
                          {formatarData(
                            plano.cronograma_plano,
                          )}
                        </td>

                        <td className="min-w-48 px-4 py-3">
                          {plano.gestor_plano ??
                            "—"}
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
    <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        {titulo}
      </p>

      <p className="mt-2 text-3xl font-semibold text-gray-900 dark:text-white">
        {valor}
      </p>
    </div>
  );
}