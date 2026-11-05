"use client";

import { useState } from "react";

import type { OrdemProgramada, ProgramacaoManutencao } from "@/lib/inspecoes/programacao";
export type { OrdemProgramada, ProgramacaoManutencao } from "@/lib/inspecoes/programacao";
const planos = [
  { id: 197, nome: "PE-017 · Inspeções de Segurança", descricao: "Plano de inspeções executadas pela Manutenção" },
  { id: 143, nome: "PG-031 · Inspeção de Segurança", descricao: "Plano bimestral da Manutenção" },
];
const concluida = (os: OrdemProgramada) => ["concluído", "finalizado"].includes(os.estagio.trim().toLocaleLowerCase("pt-BR"));
const data = (s: string | null) => s ? s.slice(0, 10).split("-").reverse().join("/") : "Não informada";

export default function MetasManutencao({ programacao, mes, concessao, localizacao }: {
  programacao: ProgramacaoManutencao; mes: string; concessao: string; localizacao: string;
}) {
  const [verOrdens, setVerOrdens] = useState(false);
  const [todas, setTodas] = useState(false);
  const [plano, setPlano] = useState<number | null>(null);
  if (mes < programacao.inicio.slice(0, 7) || mes >= programacao.fim_exclusivo.slice(0, 7)) {
    return <p role="status" className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">Programação indisponível para este mês na extração atual. A programação carregada cobre setembro a novembro de 2026.</p>;
  }
  const ordens = [...new Map(programacao.ordens.filter(o =>
    o.data_prevista.startsWith(mes) && (!concessao || o.concessao === concessao) &&
    (!localizacao || o.localizacao === localizacao)).map(o => [o.os_id, o])).values()];
  const idsComInspecao = new Set(programacao.vinculos.filter(v => v.os_id !== null).map(v => v.os_id));
  const resumo = planos.map(p => {
    const lista = ordens.filter(o => o.plano_id === p.id);
    const realizadas = lista.filter(concluida).length;
    return { ...p, meta: lista.length, realizadas, saldo: lista.length - realizadas };
  });
  const detalhes = ordens.filter(o => plano === null || o.plano_id === plano).sort((a, b) => a.data_prevista.localeCompare(b.data_prevista));
  const estagios = [...new Set(ordens.map(o => o.estagio))].map(nome => ({ nome, total: ordens.filter(o => o.estagio === nome).length }));
  const percentual = (realizado: number, meta: number) => meta ? (realizado / meta * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "%" : "Sem programação";
  return <section aria-label="Metas da programação de OS" className="min-w-0 overflow-hidden rounded-2xl border border-brand-200 bg-white dark:border-brand-900 dark:bg-gray-900">
    <div className="flex flex-wrap items-start justify-between gap-3 p-5 md:p-6">
      <div><p className="text-xs font-semibold tracking-widest text-brand-600 uppercase dark:text-brand-300">Meta × realizado</p>
        <h2 className="mt-2 text-lg font-semibold">Programação das inspeções da Manutenção</h2>
        <p className="mt-1 text-sm text-gray-500">Metas por plano, em ordens de serviço previstas no mês.</p></div>
      <span className="rounded-full bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700 dark:bg-brand-950 dark:text-brand-200">Fonte: programação do SQL Server</span>
    </div>
    <div className="space-y-4 px-5 pb-5 md:hidden">
      {resumo.map(r => <div key={r.id} className="border-t border-gray-100 pt-4 dark:border-gray-800">
        <button type="button" className="text-left text-sm font-medium text-brand-700 dark:text-brand-200" onClick={() => { setPlano(r.id); setVerOrdens(true); setTodas(false); }}>{r.nome} ↗</button>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div><p className="text-xs text-gray-500">Meta · OS</p><p className="mt-1 text-2xl font-semibold">{r.meta}</p></div>
          <div><p className="text-xs text-gray-500">Realizado</p><p className="mt-1 text-2xl font-semibold">{r.realizadas}</p></div>
          <div><p className="text-xs text-gray-500">Saldo · OS</p><p className="mt-1 text-2xl font-semibold">{r.saldo}</p></div>
        </div>
        <p className="mt-3 text-right text-sm font-medium text-brand-700 dark:text-brand-200">{percentual(r.realizadas, r.meta)}{r.meta > 0 ? " de execução" : ""}</p>
      </div>)}
    </div>
    <div className="hidden overflow-x-auto md:block">
      <table className="w-full min-w-[660px] text-left text-sm">
        <caption className="sr-only">Metas e realizações em OS por plano e data prevista atual.</caption>
        <thead className="bg-brand-50/60 text-xs text-gray-600 dark:bg-brand-950/30 dark:text-gray-300"><tr>
          <th scope="col" className="px-5 py-3 font-medium">Plano / etapa</th>
          <th scope="col" className="px-3 py-3 text-right font-medium">Meta (OS)</th>
          <th scope="col" className="px-3 py-3 text-right font-medium">Realizado (OS concluídas)</th>
          <th scope="col" className="px-3 py-3 text-right font-medium">Saldo (OS)</th>
          <th scope="col" className="px-5 py-3 text-right font-medium">Execução</th>
        </tr></thead>
        <tbody>{resumo.map(r => <tr key={r.id} className="border-t border-gray-100 dark:border-gray-800">
          <td className="px-5 py-4"><button type="button" className="text-left font-medium text-brand-700 hover:underline dark:text-brand-200" onClick={() => { setPlano(r.id); setVerOrdens(true); setTodas(false); }}>{r.nome} ↗</button><p className="mt-1 text-xs text-gray-500">{r.descricao}</p></td>
          <td className="px-3 py-4 text-right text-lg font-semibold tabular-nums">{r.meta}</td>
          <td className="px-3 py-4 text-right text-lg font-semibold tabular-nums">{r.realizadas}</td>
          <td className="px-3 py-4 text-right tabular-nums">{r.saldo}</td>
          <td className="px-5 py-4 text-right font-medium tabular-nums">{percentual(r.realizadas, r.meta)}</td>
        </tr>)}</tbody>
      </table>
    </div>
    <div className="space-y-3 p-5 text-xs text-gray-500 md:px-6">
      <div className="flex flex-wrap gap-x-5 gap-y-2">{estagios.map(e => <span key={e.nome}>{e.nome}: <strong className="text-gray-800 dark:text-gray-200">{e.total} OS</strong></span>)}<span>Com inspeção registrada na extração: <strong className="text-gray-800 dark:text-gray-200">{ordens.filter(o => idsComInspecao.has(o.os_id)).length} de {ordens.length} OS</strong></span></div>
      <p>Meta = OS distintas pela data prevista atual. Realizado = estágio Concluído ou Finalizado no SQL. A conclusão da OS não confirma, sozinha, a execução de todos os formulários.</p>
      <p>Uma OS pode reunir várias inspeções. A abertura da meta por família ou modalidade depende da lista de atividades do plano.</p>
      <button type="button" className="font-medium text-brand-600 dark:text-brand-300" aria-expanded={verOrdens} aria-controls="ordens-da-meta" onClick={() => { setVerOrdens(!verOrdens); setPlano(null); setTodas(false); }}>{verOrdens ? "Ocultar" : "Ver"} ordens que compõem a meta →</button>
    </div>
    <div id="ordens-da-meta" hidden={!verOrdens} className="border-t border-gray-100 dark:border-gray-800">
      <div className="flex items-center justify-between gap-3 px-5 py-3 text-sm"><p>{detalhes.length} OS {plano ? "do plano selecionado" : "da programação"}</p>{plano !== null && <button className="text-brand-600 dark:text-brand-300" type="button" onClick={() => setPlano(null)}>Ver todos os planos</button>}</div>
      <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead className="bg-gray-50 text-xs text-gray-500 dark:bg-gray-800"><tr>{["OS", "Concessão / localização", "Prevista", "Estágio atual", "Inspeção vinculada"].map(t => <th scope="col" key={t} className="px-5 py-3 font-medium">{t}</th>)}</tr></thead>
        <tbody>{(todas ? detalhes : detalhes.slice(0, 10)).map(o => <tr key={o.os_id} className="border-t border-gray-100 dark:border-gray-800"><td className="px-5 py-3 font-medium">{o.os_id}</td><td className="px-5 py-3">{o.concessao || "Não informada"}<p className="mt-1 text-xs text-gray-500">{o.localizacao || "Não informada"}</p></td><td className="px-5 py-3 whitespace-nowrap">{data(o.data_prevista)}</td><td className="px-5 py-3">{o.estagio}</td><td className="px-5 py-3">{idsComInspecao.has(o.os_id) ? "Sim" : "Não encontrada na extração"}</td></tr>)}</tbody></table></div>
      {detalhes.length > 10 && <button type="button" className="m-5 text-sm font-medium text-brand-600 dark:text-brand-300" onClick={() => setTodas(!todas)}>{todas ? "Mostrar apenas 10" : `Mostrar todas as ${detalhes.length} OS`}</button>}
    </div>
  </section>;
}
