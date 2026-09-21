"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type StatusSolicitacao = "PENDENTE" | "APROVADO" | "REJEITADO" | "CANCELADO";

type Solicitacao = {
  id: string;
  nome_completo: string;
  email_corporativo: string;
  empresa: string;
  cargo_funcao: string;
  projeto_unidade: string;
  justificativa: string;
  status: StatusSolicitacao;
  criado_em: string;
  atualizado_em: string;
  analisado_em: string | null;
  analisado_por: string | null;
  observacao_analise: string | null;
};

type RespostaLista = {
  total: number;
  dados: Solicitacao[];
  error?: string;
};

function formatarData(valor: string | null) {
  if (!valor) return "—";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(valor));
}

function StatusBadge({ status }: { status: StatusSolicitacao }) {
  const classes =
    status === "PENDENTE"
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : status === "APROVADO"
        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
        : status === "REJEITADO"
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-gray-200 bg-gray-50 text-gray-600";

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${classes}`}>
      {status}
    </span>
  );
}

export default function GestaoSolicitacoesAcessoPage() {
  const [dados, setDados] = useState<Solicitacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [status, setStatus] = useState("PENDENTE");
  const [empresa, setEmpresa] = useState("TODAS");
  const [busca, setBusca] = useState("");
  const [selecionada, setSelecionada] = useState<Solicitacao | null>(null);
  const [observacao, setObservacao] = useState("");
  const [processando, setProcessando] = useState<"APROVAR" | "REJEITAR" | null>(null);
  const [erroAcao, setErroAcao] = useState("");

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro("");

    try {
      const resposta = await fetch("/api/gestao/solicitacoes-acesso", {
        cache: "no-store",
      });

      const resultado = (await resposta.json()) as RespostaLista;

      if (!resposta.ok) {
        setDados([]);
        setErro(resultado.error ?? "Não foi possível carregar as solicitações.");
        return;
      }

      setDados(resultado.dados ?? []);
    } catch (error) {
      console.error(error);
      setErro("Ocorreu um erro ao carregar as solicitações.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const empresas = useMemo(
    () =>
      Array.from(new Set(dados.map((item) => item.empresa).filter(Boolean))).sort(
        (a, b) => a.localeCompare(b, "pt-BR"),
      ),
    [dados],
  );

  const contagens = useMemo(
    () => ({
      pendentes: dados.filter((item) => item.status === "PENDENTE").length,
      aprovadas: dados.filter((item) => item.status === "APROVADO").length,
      rejeitadas: dados.filter((item) => item.status === "REJEITADO").length,
      total: dados.length,
    }),
    [dados],
  );

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();

    return dados.filter((item) => {
      const statusOk = status === "TODOS" || item.status === status;
      const empresaOk = empresa === "TODAS" || item.empresa === empresa;
      const buscaOk =
        !termo ||
        [
          item.nome_completo,
          item.email_corporativo,
          item.empresa,
          item.cargo_funcao,
          item.projeto_unidade,
        ].some((valor) => valor.toLowerCase().includes(termo));

      return statusOk && empresaOk && buscaOk;
    });
  }, [dados, status, empresa, busca]);

  const analisar = async (acao: "APROVAR" | "REJEITAR") => {
    if (!selecionada || selecionada.status !== "PENDENTE") return;

    setProcessando(acao);
    setErroAcao("");

    try {
      const resposta = await fetch(
        `/api/gestao/solicitacoes-acesso/${selecionada.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ acao, observacao }),
        },
      );

      const resultado = await resposta.json();

      if (!resposta.ok) {
        setErroAcao(resultado.error ?? "Não foi possível analisar a solicitação.");
        return;
      }

      setSelecionada(null);
      setObservacao("");
      await carregar();
    } catch (error) {
      console.error(error);
      setErroAcao("Ocorreu um erro ao analisar a solicitação.");
    } finally {
      setProcessando(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm text-gray-500">Gestão / Acessos</p>
          <h1 className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">
            Solicitações de acesso
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
            Analise as solicitações de acesso ao Portal SSO. Aprovar nesta etapa não cria automaticamente uma conta de usuário.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void carregar()}
          disabled={loading}
          className="h-10 rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
        >
          {loading ? "Atualizando..." : "Atualizar"}
        </button>
      </div>

      {erro && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {erro}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Pendentes", contagens.pendentes],
          ["Aprovadas", contagens.aprovadas],
          ["Rejeitadas", contagens.rejeitadas],
          ["Total", contagens.total],
        ].map(([titulo, valor]) => (
          <div
            key={titulo}
            className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]"
          >
            <p className="text-sm text-gray-500">{titulo}</p>
            <p className="mt-2 text-3xl font-semibold text-gray-900 dark:text-white">
              {valor}
            </p>
          </div>
        ))}
      </div>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">Status</label>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm"
            >
              <option value="TODOS">Todos</option>
              <option value="PENDENTE">Pendente</option>
              <option value="APROVADO">Aprovado</option>
              <option value="REJEITADO">Rejeitado</option>
              <option value="CANCELADO">Cancelado</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">Empresa</label>
            <select
              value={empresa}
              onChange={(event) => setEmpresa(event.target.value)}
              className="h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm"
            >
              <option value="TODAS">Todas</option>
              {empresas.map((nome) => (
                <option key={nome} value={nome}>{nome}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">Busca</label>
            <input
              value={busca}
              onChange={(event) => setBusca(event.target.value)}
              placeholder="Nome, e-mail, cargo ou projeto"
              className="h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm"
            />
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="border-b border-gray-200 px-5 py-4">
          <h2 className="font-semibold text-gray-900 dark:text-white">Solicitações</h2>
          <p className="mt-1 text-xs text-gray-500">{filtrados.length} resultado(s).</p>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-gray-500">Carregando...</div>
        ) : filtrados.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">Nenhuma solicitação encontrada.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {["Solicitante", "Empresa", "Cargo", "Projeto / unidade", "Data", "Status", "Ação"].map(
                    (titulo) => (
                      <th key={titulo} className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                        {titulo}
                      </th>
                    ),
                  )}
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {filtrados.map((item) => (
                  <tr key={item.id}>
                    <td className="px-5 py-4">
                      <p className="text-sm font-medium text-gray-900">{item.nome_completo}</p>
                      <p className="mt-1 text-xs text-gray-500">{item.email_corporativo}</p>
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-700">{item.empresa}</td>
                    <td className="px-5 py-4 text-sm text-gray-700">{item.cargo_funcao}</td>
                    <td className="px-5 py-4 text-sm text-gray-700">{item.projeto_unidade}</td>
                    <td className="px-5 py-4 text-sm text-gray-700">{formatarData(item.criado_em)}</td>
                    <td className="px-5 py-4"><StatusBadge status={item.status} /></td>
                    <td className="px-5 py-4">
                      <button
                        type="button"
                        onClick={() => {
                          setSelecionada(item);
                          setObservacao(item.observacao_analise ?? "");
                          setErroAcao("");
                        }}
                        className="text-sm font-semibold text-brand-500 hover:text-brand-600"
                      >
                        Ver detalhes
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selecionada && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-500">Solicitação de acesso</p>
                <h2 className="mt-1 text-xl font-semibold text-gray-900">{selecionada.nome_completo}</h2>
                <p className="mt-1 text-sm text-gray-500">{selecionada.email_corporativo}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelecionada(null)}
                disabled={Boolean(processando)}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
              >
                Fechar
              </button>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <p className="text-sm"><strong>Empresa:</strong> {selecionada.empresa}</p>
              <p className="text-sm"><strong>Cargo:</strong> {selecionada.cargo_funcao}</p>
              <p className="text-sm"><strong>Projeto/unidade:</strong> {selecionada.projeto_unidade}</p>
              <p className="text-sm"><strong>Status:</strong> {selecionada.status}</p>
            </div>

            <div className="mt-6">
              <p className="text-xs font-semibold uppercase text-gray-400">Justificativa</p>
              <p className="mt-2 whitespace-pre-wrap rounded-xl bg-gray-50 p-4 text-sm leading-6 text-gray-700">
                {selecionada.justificativa}
              </p>
            </div>

            {selecionada.status === "PENDENTE" ? (
              <>
                <div className="mt-6">
                  <label className="mb-2 block text-sm font-medium text-gray-700">Observação da análise</label>
                  <textarea
                    value={observacao}
                    onChange={(event) => setObservacao(event.target.value)}
                    maxLength={2000}
                    className="min-h-28 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm"
                    placeholder="Inclua uma observação, se necessário."
                  />
                </div>

                {erroAcao && (
                  <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {erroAcao}
                  </div>
                )}

                <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    disabled={Boolean(processando)}
                    onClick={() => void analisar("REJEITAR")}
                    className="h-11 rounded-lg border border-red-200 px-5 text-sm font-semibold text-red-600 disabled:opacity-60"
                  >
                    {processando === "REJEITAR" ? "Rejeitando..." : "Rejeitar"}
                  </button>
                  <button
                    type="button"
                    disabled={Boolean(processando)}
                    onClick={() => void analisar("APROVAR")}
                    className="h-11 rounded-lg bg-emerald-600 px-5 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {processando === "APROVAR" ? "Aprovando..." : "Aprovar"}
                  </button>
                </div>
              </>
            ) : (
              <div className="mt-6 rounded-xl bg-gray-50 p-4 text-sm text-gray-700">
                <strong>Observação:</strong>{" "}
                {selecionada.observacao_analise || "Nenhuma observação registrada."}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
