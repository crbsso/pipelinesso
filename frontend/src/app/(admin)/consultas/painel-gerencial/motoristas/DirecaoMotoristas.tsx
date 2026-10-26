"use client";

import { useEffect, useState } from "react";

type Episodio = {
  episodio_id: string;
  driver_id_cobli: string;
  nome_exibicao: string;
  placas: string | null;
  inicio: string;
  fim: string;
  duracao_min: number;
  viagens: number;
  status: string;
};

type Resposta = {
  dados: Episodio[];
  paginacao: {
    pagina: number;
    limite: number;
    total: number;
  };
  aviso: string;
  cobertura_ate: string | null;
};

type ModoPeriodo = "MES" | "SEMANA" | "PERSONALIZADO";
const MESES = ["Janeiro", "Fevereiro", "Mar?o", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const PARTES_HOJE = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", year: "numeric", month: "numeric" }).formatToParts(new Date());
const ANO_INICIAL = Number(PARTES_HOJE.find((p) => p.type === "year")?.value);
const MES_INICIAL = Number(PARTES_HOJE.find((p) => p.type === "month")?.value);

function diaIso(ano: number, mes: number, dia: number): string {
  return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}
function ultimoDia(ano: number, mes: number): number {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}
function semanasDoMes(ano: number, mes: number) {
  const semanas: { inicio: string; fim: string }[] = [];
  const ultimo = ultimoDia(ano, mes);
  let dia = 1;
  while (dia <= ultimo) {
    const semana = new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay();
    const fim = Math.min(ultimo, dia + 6 - ((semana + 6) % 7));
    semanas.push({ inicio: diaIso(ano, mes, dia), fim: diaIso(ano, mes, fim) });
    dia = fim + 1;
  }
  return semanas;
}
function dataBr(iso: string): string {
  return iso.split("-").reverse().join("/");
}

function horario(valor: string): string {
  const iso = valor.replace(" ", "T");
  const utc = /(?:Z|[+-]\d\d:\d\d)$/.test(iso)
    ? iso
    : `${iso}Z`;

  const data = new Date(utc);

  if (Number.isNaN(data.getTime())) return "-";

  return data.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
  });
}

function formatarDuracao(minutos: number): string {
  if (!Number.isFinite(minutos) || minutos < 0) return "-";
  const total = Math.round(minutos);
  const horas = Math.floor(total / 60);
  const resto = String(total % 60).padStart(2, "0");
  return `${horas}h${resto}min`;
}

export default function DirecaoMotoristas({
  coligada,
  secao,
}: {
  coligada: string;
  secao: string;
}) {
  const [pagina, setPagina] = useState(1);
  const [resultado, setResultado] = useState<Resposta | null>(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  const [ano, setAno] = useState(ANO_INICIAL);
  const [mes, setMes] = useState(MES_INICIAL);
  const [modoPeriodo, setModoPeriodo] = useState<ModoPeriodo>("MES");
  const [indiceSemana, setIndiceSemana] = useState(0);
  const [inicioPersonalizado, setInicioPersonalizado] = useState(diaIso(ANO_INICIAL, MES_INICIAL, 1));
  const [fimPersonalizado, setFimPersonalizado] = useState(diaIso(ANO_INICIAL, MES_INICIAL, ultimoDia(ANO_INICIAL, MES_INICIAL)));

  const semanas = semanasDoMes(ano, mes);
  const semana = semanas[Math.min(indiceSemana, semanas.length - 1)];
  const inicioMes = diaIso(ano, mes, 1);
  const fimMes = diaIso(ano, mes, ultimoDia(ano, mes));

  const periodoInicio = modoPeriodo === "PERSONALIZADO"
    ? (!inicioPersonalizado ? "" : inicioPersonalizado > inicioMes ? inicioPersonalizado : inicioMes)
    : modoPeriodo === "SEMANA" ? semana.inicio : inicioMes;

  const periodoFim = modoPeriodo === "PERSONALIZADO"
    ? (!fimPersonalizado ? "" : fimPersonalizado < fimMes ? fimPersonalizado : fimMes)
    : modoPeriodo === "SEMANA" ? semana.fim : fimMes;


  useEffect(() => {
    setPagina(1);
  }, [coligada, secao, periodoInicio, periodoFim]);

  useEffect(() => {
    const controlador = new AbortController();

    async function consultar() {
      if (!periodoInicio || !periodoFim || periodoInicio > periodoFim) {
        setResultado(null);
        setErro("Selecione um intervalo de datas valido.");
        setCarregando(false);
        return;
      }
      setCarregando(true);
      setErro("");

      const q = new URLSearchParams({
        pagina: String(pagina),
        inicio: periodoInicio,
        fim: periodoFim,
      });

      if (coligada !== "TODOS") q.set("coligada", coligada);
      if (secao !== "TODOS") q.set("secao", secao);

      try {
        const resposta = await fetch(
          `/api/motoristas/direcao?${q}`,
          {
            cache: "no-store",
            signal: controlador.signal,
          },
        );

        if (!resposta.ok) {
          throw new Error(
            resposta.status === 404
              ? "A visao historica ainda nao foi habilitada neste ambiente."
              : "Nao foi possivel consultar os candidatos.",
          );
        }

        const json = (await resposta.json()) as Resposta;

        if (!controlador.signal.aborted) {
          setResultado(json);
        }
      } catch (e) {
        if (!controlador.signal.aborted) {
          setResultado(null);
          setErro(
            e instanceof Error
              ? e.message
              : "Erro de consulta.",
          );
        }
      } finally {
        if (!controlador.signal.aborted) {
          setCarregando(false);
        }
      }
    }

    void consultar();

    return () => controlador.abort();
  }, [coligada, secao, pagina, periodoInicio, periodoFim]);

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="grid gap-4 lg:grid-cols-3">
          <label className="text-sm">
            <span className="mb-1 block text-gray-600 dark:text-gray-300">Ano</span>
            <select value={ano} onChange={(e) => {
              const valor = Number(e.target.value);
              setAno(valor);
              setIndiceSemana(0);
              setInicioPersonalizado(diaIso(valor, mes, 1));
              setFimPersonalizado(diaIso(valor, mes, ultimoDia(valor, mes)));
            }} className="w-full rounded-lg border border-gray-300 bg-transparent p-2 dark:border-gray-700">
              {Array.from(
                { length: ANO_INICIAL - 2020 + 1 },
                (_, i) => ANO_INICIAL - i
              ).map((valor) => (
                <option key={valor} value={valor}>{valor}</option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            <span className="mb-1 block text-gray-600 dark:text-gray-300">Mês</span>
            <select value={mes} onChange={(e) => {
              const valor = Number(e.target.value);
              setMes(valor);
              setIndiceSemana(0);
              setInicioPersonalizado(diaIso(ano, valor, 1));
              setFimPersonalizado(diaIso(ano, valor, ultimoDia(ano, valor)));
            }} className="w-full rounded-lg border border-gray-300 bg-transparent p-2 dark:border-gray-700">
              {MESES.map((nome, i) => (
                <option key={nome} value={i + 1}>{nome}</option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            <span className="mb-1 block text-gray-600 dark:text-gray-300">Tipo de período</span>
            <select value={modoPeriodo} onChange={(e) =>
              setModoPeriodo(e.target.value as ModoPeriodo)
            } className="w-full rounded-lg border border-gray-300 bg-transparent p-2 dark:border-gray-700">
              <option value="MES">Mês inteiro</option>
              <option value="SEMANA">Semana</option>
              <option value="PERSONALIZADO">Período personalizado</option>
            </select>
          </label>
        </div>

        {modoPeriodo === "SEMANA" && (
          <label className="mt-4 block text-sm">
            <span className="mb-1 block text-gray-600 dark:text-gray-300">Semana</span>
            <select value={indiceSemana} onChange={(e) =>
              setIndiceSemana(Number(e.target.value))
            } className="w-full rounded-lg border border-gray-300 bg-transparent p-2 dark:border-gray-700">
              {semanas.map((s, i) => (
                <option key={s.inicio} value={i}>
                  Semana {i + 1} ({dataBr(s.inicio)} a {dataBr(s.fim)})
                </option>
              ))}
            </select>
          </label>
        )}

        {modoPeriodo === "PERSONALIZADO" && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block text-gray-600 dark:text-gray-300">Data inicial</span>
              <input type="date" min={inicioMes} max={fimMes}
                value={inicioPersonalizado}
                onChange={(e) => setInicioPersonalizado(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-transparent p-2 dark:border-gray-700"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-gray-600 dark:text-gray-300">Data final</span>
              <input type="date" min={inicioMes} max={fimMes}
                value={fimPersonalizado}
                onChange={(e) => setFimPersonalizado(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-transparent p-2 dark:border-gray-700"
              />
            </label>
          </div>
        )}

        <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
          Filtro pela data local de início do episódio.
          Coligada e Seção continuam aplicadas.
        </p>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        Regra: mais de 4 horas ininterruptas, sem pausa registrada.
        Os registros sao candidatos para revisao, nao infracoes confirmadas.
        A cobertura depende do historico efetivamente publicado.
      </div>

      {carregando && (
        <p role="status">Consultando historico...</p>
      )}

      {erro && (
        <p role="alert" className="text-sm text-red-700">
          {erro}
        </p>
      )}

      {resultado && !carregando && (
        <>
          <p className="text-sm text-gray-600">
            {resultado.paginacao.total} periodo(s) candidato(s)
            no historico disponivel.
          </p>

          <p className="text-xs text-gray-500 dark:text-gray-400">
            Data mais recente do historico:{" "}
            {resultado.cobertura_ate
              ? resultado.cobertura_ate.split("-").reverse().join("/")
              : "nao informada"}
          </p>

          <div className="grid gap-3 lg:grid-cols-2">
            {resultado.dados.map((e) => (
              <article
                key={e.episodio_id}
                className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900"
              >
                <div className="mb-2 flex items-center justify-between gap-3">
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    {e.nome_exibicao || "Nao identificado"}
                  </h3>

                  <strong className="text-amber-700">
                    {formatarDuracao(Number(e.duracao_min))}
                  </strong>
                </div>

                <dl className="grid gap-1 text-sm text-gray-600 dark:text-gray-300">
                  <div>Veiculo(s): {e.placas || "Sem placa"}</div>
                  <div>Inicio: {horario(e.inicio)}</div>
                  <div>Fim: {horario(e.fim)}</div>
                  <div>Viagens relacionadas: {e.viagens}</div>
                  <div>Situacao: candidato sem pausa registrada</div>
                </dl>
              </article>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              className="rounded border px-3 py-2 disabled:opacity-40"
              disabled={pagina <= 1}
              onClick={() => setPagina((p) => p - 1)}
            >
              Anterior
            </button>

            <span className="text-sm">Pagina {pagina}</span>

            <button
              type="button"
              className="rounded border px-3 py-2 disabled:opacity-40"
              disabled={
                pagina * resultado.paginacao.limite >=
                resultado.paginacao.total
              }
              onClick={() => setPagina((p) => p + 1)}
            >
              Proxima
            </button>
          </div>
        </>
      )}
    </section>
  );
}
