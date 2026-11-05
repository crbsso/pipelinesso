"use client";

import { useState } from "react";
import type { InspecaoManutencao, VisaoManutencao } from "@/lib/inspecoes/manutencao";

import type { MetaTipoInspecao } from "@/lib/inspecoes/programacao";
export type { MetaTipoInspecao } from "@/lib/inspecoes/programacao";
export const TITULOS_INSPECOES: Record<string, string> = {
  "Inspeção de EPIs": "EPIs",
  "Inspeção de Ferramentas e Equipamentos Rotativos": "Ferramentas e equipamentos",
  "Inspeção de Movimentação de Carga e Acessórios": "Movimentação de carga",
  "Inspeção de Segurança em Instalações": "Segurança em instalações",
  "Inspeção em Extintores de Incêndio": "Extintores",
  "Inspeção em Veículos": "Veículos",
};
const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const numero = (n: number) => n.toLocaleString("pt-BR");
export function mesesDoRecorte(mes: string, visao: VisaoManutencao) {
  const ano = mes.slice(0, 4);
  const indice = Number(mes.slice(5, 7)) - 1;
  const indices = visao === "anual" ? Array.from({ length: 12 }, (_, i) => i)
    : visao === "trimestral" ? Array.from({ length: 3 }, (_, i) => Math.floor(indice / 3) * 3 + i) : [indice];
  return indices.map(i => `${ano}-${String(i + 1).padStart(2, "0")}`);
}

export default function GraficoTipoInspecao({ familia, dados, metas = [], mes, visao, concessao, localizacao, onDetalhar }: {
  familia: string; dados: InspecaoManutencao[]; metas?: MetaTipoInspecao[];
  mes: string; visao: VisaoManutencao; concessao: string; localizacao: string;
  onDetalhar: (familia: string, tipo: string) => void;
}) {
  const [modalidade, setModalidade] = useState("");
  const registrosFamilia = dados.filter(d => d.familia === familia);
  const modalidades = [...new Set(registrosFamilia.map(d => d.tipo))].sort();
  const tipo = modalidades.includes(modalidade) ? modalidade : "";
  const escopo = registrosFamilia.filter(d => (!tipo || d.tipo === tipo) &&
    (!concessao || d.concessao === concessao) && (!localizacao || d.localizacao === localizacao));
  const metasEscopo = metas.filter(d => d.validada && d.unidade === "atividades_os" && d.familia === familia &&
    (!tipo || d.tipo === tipo) && (!concessao || d.concessao === concessao) &&
    (!localizacao || d.localizacao === localizacao));
  const mesesRecorte = mesesDoRecorte(mes, visao);
  // Presença de registros sinaliza somente disponibilidade da extração, nunca completude da obrigação.
  const mesesComDados = new Set(dados.map(d => d.data_inspecao.slice(0, 7)));
  const mesesMeta = new Set(metasEscopo.map(d => d.mes));
  const registros = escopo.filter(d => mesesRecorte.includes(d.data_inspecao.slice(0, 7)));
  const temDados = mesesRecorte.some(m => mesesComDados.has(m));
  const metaCompleta = mesesRecorte.every(m => mesesMeta.has(m));
  const temMeta = mesesRecorte.some(m => mesesMeta.has(m));
  const meta = temMeta ? metasEscopo.filter(d => mesesRecorte.includes(d.mes)).reduce((s, d) => s + d.quantidade, 0) : null;
  const metasPeriodo = metasEscopo.filter(d => mesesRecorte.includes(d.mes));
  const realizadasAtividades = metasPeriodo.reduce((s, d) => s + d.realizadas, 0);
  const outrosEstados = metasPeriodo.reduce((s, d) => s + d.outrosEstados, 0);
  const modoAtividades = metas.length > 0;
  const realizado = modoAtividades ? (temMeta ? realizadasAtividades : null) : temDados ? registros.length : null;
  const saldo = meta === null || realizado === null ? null : Math.max(0, meta - realizado);
  const periodicidades = [...new Set(registrosFamilia.filter(d => !tipo || d.tipo === tipo).map(d => d.periodicidade).filter(Boolean))];
  const primeiroMes = Math.min(Number(mes.slice(5, 7)), ...[...mesesComDados].filter(m => m.startsWith(mes.slice(0, 4))).map(m => Number(m.slice(5, 7))));
  const mesesGrafico = visao === "mensal" ? Array.from({ length: Number(mes.slice(5, 7)) - primeiroMes + 1 }, (_, i) => `${mes.slice(0, 4)}-${String(primeiroMes + i).padStart(2, "0")}`) : mesesRecorte;
  const pontos = mesesGrafico.map(m => ({
    mes: m, rotulo: MESES[Number(m.slice(5, 7)) - 1],
    realizado: modoAtividades ? (mesesMeta.has(m) ? metasEscopo.filter(d => d.mes === m).reduce((s, d) => s + d.realizadas, 0) : null) : mesesComDados.has(m) ? escopo.filter(d => d.data_inspecao.startsWith(m)).length : null,
    meta: mesesMeta.has(m) ? metasEscopo.filter(d => d.mes === m).reduce((s, d) => s + d.quantidade, 0) : null,
  }));
  const maximo = Math.max(1, ...pontos.flatMap(p => [p.realizado ?? 0, p.meta ?? 0]));
  const cobertura = mesesRecorte.filter(m => modoAtividades ? mesesMeta.has(m) : mesesComDados.has(m)).length;
  const titulo = TITULOS_INSPECOES[familia] ?? familia;

  return <article aria-label={`Gráfico de ${titulo}`} className="min-w-0 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900 md:p-6">
    <header><h2 className="text-lg font-semibold tracking-tight">{titulo}</h2><p className="mt-1 text-xs text-gray-500">{periodicidades.join(" · ") || "Periodicidade não informada"} <span className="text-gray-400">· cadastro de origem</span></p></header>
    <label className="mt-4 flex flex-col gap-1.5 text-xs text-gray-500">Modalidade / formulário
      <select aria-label={`Modalidade de ${titulo}`} className="w-full min-w-0 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-500/15 dark:focus:border-brand-500" value={tipo} onChange={e => setModalidade(e.target.value)}>
        <option value="">Todas as modalidades</option>{modalidades.map(m => <option key={m}>{m}</option>)}
      </select>
    </label>
    <div className="mt-5 grid grid-cols-3 gap-2" aria-live="polite">
      <div><p className="text-xs text-gray-500">{!metaCompleta && temMeta ? "Meta parcial" : "Meta própria"}</p><p className="mt-1 text-2xl font-semibold tabular-nums">{meta === null ? "—" : numero(meta)}</p><p className="mt-1 text-xs text-gray-500">{meta === null ? "A vincular" : "Atividades previstas"}</p></div>
      <div><p className="text-xs text-gray-500">Realizado</p><p className="mt-1 text-2xl font-semibold tabular-nums text-brand-600 dark:text-brand-300">{realizado === null ? "—" : numero(realizado)}</p><p className="mt-1 text-xs text-gray-500">{modoAtividades ? "Atividades concluídas" : temDados ? "Formulários no recorte" : "Sem dados no recorte"}</p></div>
      <div><p className="text-xs text-gray-500">Saldo</p><p className="mt-1 text-2xl font-semibold tabular-nums">{saldo === null ? "—" : numero(saldo)}</p><p className="mt-1 text-xs text-gray-500">{saldo === null ? "Depende da meta" : "Previstas − concluídas"}</p></div>
    </div>
    {modoAtividades && <p className="mt-4 text-xs text-gray-500">{tipo ? "A programação não está dividida por formulário. Volte a Todas as modalidades para comparar a meta deste tipo." : "Unidade: atividades de inspeção nas OS do PE-017."}</p>}
    <div className="mt-5 flex flex-wrap items-center gap-4 text-xs text-gray-500">
      <span className="flex items-center gap-1.5"><i aria-hidden="true" className="h-2.5 w-2.5 rounded-sm bg-brand-500 dark:bg-brand-400" />Realizado</span>
      <span className="flex items-center gap-1.5"><i aria-hidden="true" className="h-2.5 w-2.5 rounded-sm bg-brand-100 ring-1 ring-inset ring-brand-300 dark:bg-brand-900 dark:ring-brand-600" />{metaCompleta ? "Meta" : "Meta ainda não vinculada"}</span>
    </div>
    <div className="mt-3 flex min-h-48 gap-1" role="group" aria-label={`Evolução de ${titulo}`}>
      {pontos.map(p => <div key={p.mes} className="min-w-0 flex-1" aria-label={`${p.rotulo}: realizado ${p.realizado ?? "sem dados"}, meta ${p.meta ?? "não vinculada"}`}>
        <div className="flex h-40 items-end justify-center gap-1 border-b border-gray-100 dark:border-gray-800">
          {p.meta !== null && <div className="flex h-full min-w-0 w-7 flex-col justify-end"><span className="mb-1 text-center text-xs text-gray-500">{p.meta}</span><div className="rounded-t bg-brand-100 ring-1 ring-inset ring-brand-300 dark:bg-brand-900 dark:ring-brand-600" style={{ height: `${p.meta / maximo * 125}px` }} /></div>}
          <div className="flex h-full min-w-0 w-7 flex-col justify-end"><span className="mb-1 text-center text-xs font-medium">{p.realizado === null ? "—" : numero(p.realizado)}</span><div className="rounded-t bg-brand-500 dark:bg-brand-400" style={{ height: `${(p.realizado ?? 0) / maximo * 125}px` }} /></div>
        </div><p className={`mt-2 text-center text-xs ${p.mes === mes ? "font-semibold text-brand-600 dark:text-brand-300" : "text-gray-500"}`}>{p.rotulo}</p>
      </div>)}
    </div>
    {modoAtividades && <p className="mt-3 text-xs leading-5 text-gray-500">{numero(registros.length)} formulários registrados no recorte.{outrosEstados > 0 ? ` Há ${outrosEstados} atividade(s) em outros estados, incluída(s) no saldo.` : ""}</p>}
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3 text-xs dark:border-gray-800">
      <span className="text-gray-500">{cobertura < mesesRecorte.length ? `Recorte parcial · ${cobertura}/${mesesRecorte.length} meses disponíveis` : `${mesesRecorte.length === 1 ? "Mês" : "Período"} disponível na extração`}</span>
      <button type="button" className="font-medium text-brand-600 dark:text-brand-300" onClick={() => onDetalhar(familia, tipo)}>Ver inspeções →</button>
    </div>
  </article>;
}
