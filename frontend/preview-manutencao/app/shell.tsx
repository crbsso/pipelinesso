"use client";
import { useState } from "react";
import type { ProgramacaoManutencao } from "../../src/app/(admin)/consultas/painel-gerencial/inspecoes/MetasManutencao";
import type { MetaTipoInspecao } from "../../src/app/(admin)/consultas/painel-gerencial/inspecoes/GraficoTipoInspecao";
import PainelManutencao from "../../src/app/(admin)/consultas/painel-gerencial/inspecoes/PainelManutencao";
import type { InspecaoManutencao } from "../../src/lib/inspecoes/manutencao";

export default function PreviewShell({ dados, extracao, programacao, metasPorTipo }: {
  dados: InspecaoManutencao[]; extracao: string; programacao: ProgramacaoManutencao; metasPorTipo: MetaTipoInspecao[];
}) {
  const [fonte, setFonte] = useState("manutencao");
  return <div className="min-h-screen text-gray-900">
    <header className="border-b border-gray-200 bg-white"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-4 md:px-8">
      <div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-800 text-sm font-bold text-white">SSO</span><span className="text-sm font-semibold">Portal de Segurança e Saúde</span></div>
      <span className="text-xs text-gray-500">Prévia local · dados reais da Manutenção</span></div></header>
    <main className="mx-auto max-w-7xl px-5 py-6 md:px-8 md:py-8">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4"><p className="text-xs text-gray-500">Painel gerencial <span className="mx-2">/</span> Inspeções</p>
        <div role="group" aria-label="Origem das inspeções" className="inline-flex gap-1 rounded-xl border border-gray-200 bg-white p-1">
          {[["seguranca", "Segurança"], ["manutencao", "Manutenção"]].map(([valor, nome]) => <button key={valor} type="button" aria-pressed={fonte === valor} onClick={() => setFonte(valor)} className={`rounded-lg px-4 py-2 text-sm font-medium ${fonte === valor ? "bg-teal-800 text-white" : "text-gray-500 hover:bg-gray-50"}`}>{nome}</button>)}
        </div>
      </div>
      <div hidden={fonte !== "manutencao"}><PainelManutencao dadosIniciais={dados} extracaoLocal={extracao} programacao={programacao} metasPorTipo={metasPorTipo} /></div>
      {fonte === "seguranca" && <section className="rounded-2xl border border-gray-200 bg-white p-8"><p className="text-xs font-semibold tracking-widest text-teal-700 uppercase">Inspeções de Segurança</p><h1 className="mt-3 text-2xl font-semibold">Processo do Prevsys</h1><p className="mt-3 max-w-xl text-sm leading-6 text-gray-500">O painel existente do Prevsys permanece no portal. Esta prévia apresenta somente a nova área da Manutenção.</p><button type="button" className="mt-5 rounded-lg bg-teal-800 px-4 py-2.5 text-sm font-medium text-white" onClick={() => setFonte("manutencao")}>Voltar à Manutenção</button></section>}
    </main>
  </div>;
}
