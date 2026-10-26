"use client";

import { useEffect, useState, type FormEvent } from "react";

type Evento = {
  evento_id: string;
  tipo_evento: string;
  data_evento?: string | null;
  inicio?: string | null;
  fim?: string | null;
  nome_exibicao?: string | null;
  coligada?: string | null;
  secao_rm?: string | null;
  situacao_motorista?: string | null;
  status_identificacao_condutor?: string | null;
  tipo_registro?: string | null;
  noturno?: boolean;
  fim_de_semana?: boolean;
  distancia_km?: number | null;
  duracao_viagem_min?: number | null;
  marcha_lenta_min?: number | null;
};

type RespostaApi = {
  dados?: { eventos?: Evento[] };
  paginacao?: {
    pagina: number;
    limite: number;
    total_registros: number;
    total_paginas: number;
  };
};

type Props = {
  coligada: string;
  secao: string;
};

const LIMITE = 20;

const meses = [
  "Janeiro", "Fevereiro", "Março", "Abril",
  "Maio", "Junho", "Julho", "Agosto",
  "Setembro", "Outubro", "Novembro", "Dezembro",
];

function horario(valor?: string | null) {
  if (!valor) return "—";
  return valor.replace("T", " ").slice(0, 16);
}

function numero(valor?: number | null, casas = 1) {
  if (typeof valor !== "number" || !Number.isFinite(valor)) {
    return "—";
  }

  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  }).format(valor);
}

function medida(
  valor: number | null | undefined,
  casas: number,
  unidade: string,
) {
  if (typeof valor !== "number" || !Number.isFinite(valor)) {
    return "\u2014";
  }

  return `${numero(valor, casas)} ${unidade}`;
}

const campo =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 " +
  "dark:border-gray-700 dark:bg-gray-900 dark:text-white";

export default function HistoricoMotoristas({
  coligada,
  secao,
}: Props) {
  const [ano, setAno] = useState(
    String(new Date().getFullYear())
  );
  const [mes, setMes] = useState(
    String(new Date().getMonth() + 1)
  );
  const [tipo, setTipo] = useState("");
  const [motoristaDigitado, setMotoristaDigitado] = useState("");
  const [motorista, setMotorista] = useState("");
  const [pagina, setPagina] = useState(1);

  const [eventos, setEventos] = useState<Evento[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPaginas, setTotalPaginas] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    setPagina(1);
  }, [coligada, secao]);

  useEffect(() => {
    const controle = new AbortController();

    async function consultar() {
      setCarregando(true);
      setErro("");
      setEventos([]);
      setTotal(0);
      setTotalPaginas(0);

      const parametros = new URLSearchParams();

      parametros.set("pagina", String(pagina));
      parametros.set("limite", String(LIMITE));

      if (ano) parametros.set("ano", ano);
      if (mes) parametros.set("mes", mes);
      if (tipo) parametros.set("tipo_evento", tipo);
      if (motorista) parametros.set("motorista", motorista);

      if (coligada && coligada !== "TODOS") {
        parametros.set("coligada", coligada);
      }

      if (secao && secao !== "TODOS") {
        parametros.set("secao", secao);
      }

      try {
        const resposta = await fetch(
          `/api/motoristas/historico?${parametros.toString()}`,
          {
            cache: "no-store",
            signal: controle.signal,
          }
        );

        if (!resposta.ok) {
          throw new Error(`Erro HTTP ${resposta.status}.`);
        }

        const resultado: RespostaApi = await resposta.json();

        if (
          !Array.isArray(resultado?.dados?.eventos) ||
          typeof resultado?.paginacao?.total_registros !== "number" ||
          typeof resultado?.paginacao?.total_paginas !== "number"
        ) {
          throw new Error("Formato de resposta inesperado.");
        }

        if (!controle.signal.aborted) {
          setEventos(resultado.dados.eventos);
          setTotal(resultado.paginacao.total_registros);
          setTotalPaginas(resultado.paginacao.total_paginas);
        }
      } catch (falha) {
        if (!controle.signal.aborted) {
          setErro(
            falha instanceof Error
              ? `Não foi poss?vel consultar o histórico: ${falha.message}`
              : "Não foi poss?vel consultar o histórico."
          );
        }
      } finally {
        if (!controle.signal.aborted) {
          setCarregando(false);
        }
      }
    }

    void consultar();
    return () => controle.abort();
  }, [ano, mes, tipo, motorista, coligada, secao, pagina]);

  function filtrarMotorista(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setPagina(1);
    setMotorista(motoristaDigitado.trim());
  }

  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Histórico de Viagens e Paradas
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Registros efetivamente publicados no histórico Cobli.
          Os horários são exibidos conforme retornados pela API.
        </p>
      </div>

      <div className="grid gap-3 rounded-2xl border border-gray-200 bg-white p-4 md:grid-cols-3 xl:grid-cols-4 dark:border-gray-800 dark:bg-gray-900">
        <label className="space-y-1 text-sm">
          <span>Ano</span>
          <input
            className={campo}
            type="number"
            min={2020}
            max={2100}
            value={ano}
            onChange={(e) => {
              setAno(e.target.value);
              setPagina(1);
            }}
          />
        </label>

        <label className="space-y-1 text-sm">
          <span>Mês</span>
          <select
            className={campo}
            value={mes}
            onChange={(e) => {
              setMes(e.target.value);
              setPagina(1);
            }}
          >
            <option value="">Todos os meses</option>
            {meses.map((nome, indice) => (
              <option key={nome} value={String(indice + 1)}>
                {nome}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1 text-sm">
          <span>Tipo de evento</span>
          <select
            className={campo}
            value={tipo}
            onChange={(e) => {
              setTipo(e.target.value);
              setPagina(1);
            }}
          >
            <option value="">Todos</option>
            <option value="VIAGEM">Viagens</option>
            <option value="PARADA">Paradas</option>
          </select>
        </label>

        <form
          onSubmit={filtrarMotorista}
          className="space-y-1 text-sm"
        >
          <label htmlFor="historico-motorista">
            Motorista
          </label>
          <div className="flex gap-2">
            <input
              id="historico-motorista"
              className={campo}
              placeholder="Nome do motorista"
              value={motoristaDigitado}
              onChange={(e) =>
                setMotoristaDigitado(e.target.value)
              }
            />
            <button
              type="submit"
              className="rounded-lg bg-slate-900 px-3 py-2 font-medium text-white"
            >
              Buscar
            </button>
          </div>
        </form>
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400">
        — indica campo não informado pela API.
      </p>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <p className="text-gray-600 dark:text-gray-300">
          {carregando
            ? "Consultando histórico..."
            : `${total} evento(s) encontrado(s)`}
        </p>
        <p className="text-gray-500 dark:text-gray-400">
          Coligada: {coligada || "TODOS"} · Seção: {secao || "TODOS"}
        </p>
      </div>

      {erro && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {erro}
        </div>
      )}

      {!erro && !carregando && eventos.length === 0 && (
        <p
          role="status"
          className="rounded-xl border border-gray-200 p-5 text-sm text-gray-500"
        >
          Nenhum evento encontrado para os filtros selecionados.
        </p>
      )}

      {!erro && eventos.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
          <table className="w-full min-w-[760px] table-fixed text-left text-xs xl:text-sm">
            <colgroup>
              <col className="w-[16%]" />
              <col className="w-[9%]" />
              <col className="w-[20%]" />
              <col className="w-[27%]" />
              <col className="w-[9%]" />
              <col className="w-[9%]" />
              <col className="w-[10%]" />
            </colgroup>
            <thead className="bg-gray-50 text-gray-700 dark:bg-gray-800 dark:text-gray-200">
              <tr>
                <th className="px-2 py-3">Início (API)</th>
                <th className="px-2 py-3">Evento</th>
                <th className="px-2 py-3">Motorista</th>
                <th className="px-2 py-3">Coligada / Seção</th>
                <th className="px-2 py-3">Distância</th>
                <th className="px-2 py-3">Duração</th>
                <th className="px-2 py-3">Condições</th>
              </tr>
            </thead>
            <tbody>
              {eventos.map((evento) => (
                <tr
                  key={evento.evento_id}
                  className="border-t border-gray-200 dark:border-gray-800"
                >
                  <td className="px-2 py-3 whitespace-nowrap">
                    {horario(evento.inicio)}
                  </td>
                  <td className="px-2 py-3">
                    {evento.tipo_evento}
                  </td>
                  <td className="px-2 py-3">
                    <div className="font-medium">
                      {evento.nome_exibicao || "Não identificado"}
                    </div>
                    <div className="break-words text-xs text-gray-500">
                      {evento.status_identificacao_condutor || "—"}
                    </div>
                  </td>
                  <td className="px-2 py-3">
                    <div>{evento.coligada || "—"}</div>
                    <div className="break-words text-xs text-gray-500">
                      {evento.secao_rm || "—"}
                    </div>
                  </td>
                  <td className="px-2 py-3 whitespace-nowrap">
                    {medida(evento.distancia_km, 2, "km")}
                  </td>
                  <td className="px-2 py-3 whitespace-nowrap">
                    {medida(evento.duracao_viagem_min, 0, "min")}
                  </td>
                  <td className="px-2 py-3">
                    <div>{typeof evento.noturno === "boolean"
                      ? (evento.noturno ? "Noturno" : "Diurno")
                      : "—"}</div>
                    <div className="break-words text-xs text-gray-500">
                      {typeof evento.fim_de_semana === "boolean"
                        ? evento.fim_de_semana
                          ? "Fim de semana"
                          : "Dia útil"
                        : "—"}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!erro && totalPaginas > 0 && (
        <div className="flex items-center justify-end gap-3 text-sm">
          <button
            type="button"
            disabled={carregando || pagina <= 1}
            onClick={() => setPagina((p) => Math.max(1, p - 1))}
            className="rounded-lg border px-3 py-2 disabled:opacity-40"
          >
            Anterior
          </button>

          <span>
            Página {pagina} de {totalPaginas}
          </span>

          <button
            type="button"
            disabled={carregando || pagina >= totalPaginas}
            onClick={() => setPagina((p) => p + 1)}
            className="rounded-lg border px-3 py-2 disabled:opacity-40"
          >
            Próxima
          </button>
        </div>
      )}
    </section>
  );
}
