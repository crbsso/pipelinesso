"use client";
import { useEffect, useState } from "react";
import type { Pagina } from "@/lib/gestao/contratos";
export const campo = "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white";
export const botao = "rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50";
export const secundario = "rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium disabled:opacity-50";
export const painel = "rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900";
export function useConsulta<T>(url: string | null) {
  const [revisao, setRevisao] = useState(0);
  const chave = url + "#" + revisao;
  const [estado, setEstado] = useState<{ chave: string; dados: T | null; erro: string ;}>({ chave: "", dados: null, erro: "" });
  useEffect(() => {
    if (!url) return;
    const controle = new AbortController();
    fetch(url, { cache: "no-store", signal: controle.signal })
      .then(async r => { const v = await r.json(); if (!r.ok) throw new Error(v.error ?? "Não foi possível carregar os dados."); return v as T; })
      .then(dados => { if (!controle.signal.aborted) setEstado({ chave, dados, erro: "" }); })
      .catch((e: unknown) => { if (!controle.signal.aborted) setEstado({ chave, dados: null, erro: e instanceof Error ? e.message : "Falha na consulta." }); });
    return () => controle.abort();
  }, [url, chave]);
  const atual = estado.chave === chave;
  return {
dados: atual ? estado.dados : null, erro: atual ? estado.erro : "", carregando: Boolean(url) && !atual,
    atualizar: () => setRevisao(v => v + 1)
};
}
export function Aviso({ erro, mensagem }: { erro?: string; mensagem?: string ;}) {
  if (!erro && !mensagem) return null;
  return <p role={erro ? "alert" : "status"} className={`rounded-lg border p-3 text-sm ${erro ?
    "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>{erro || mensagem}</p>;
}
export function Paginacao({ pagina, total, alterar, limite = 25 }: { pagina: number; total: number; alterar: (p: number) => void; limite?: number ;}) {
  return <div className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
    <span>{total} registro(s) · Página {pagina} de {Math.max(1, Math.ceil(total / limite))}</span>
    <div className="flex gap-2">
      <button type="button" className={secundario} disabled={pagina <= 1} onClick={() => alterar(pagina - 1)}>Anterior</button>
      <button type="button" className={secundario} disabled={pagina * limite >= total} onClick={() => alterar(pagina + 1)}>Próxima</button>
    </div>
  </div>;
}
export function Cabecalho({ titulo, descricao, atualizar }: { titulo: string; descricao: string; atualizar: () => void ;}) {
  return <header className="flex flex-wrap items-start justify-between gap-4">
    <div><p className="text-sm text-gray-500">Gestão / Acessos</p><h1 className="mt-1 text-2xl font-semibold">{titulo}</h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-500">{descricao}</p></div>
    <button type="button" className={secundario} onClick={atualizar}>Atualizar</button>
  </header>;
}
export type Lista<T> = Pagina<T>;
