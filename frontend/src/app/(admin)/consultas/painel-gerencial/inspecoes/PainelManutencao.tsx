"use client";

import { useEffect, useMemo, useState } from "react";
import MetasManutencao, { type ProgramacaoManutencao } from "./MetasManutencao";
import GraficoTipoInspecao, { TITULOS_INSPECOES, mesesDoRecorte, type MetaTipoInspecao } from "./GraficoTipoInspecao";
import { FAMILIAS_MANUTENCAO, formatarDataManutencao, type InspecaoManutencao, type VisaoManutencao } from "@/lib/inspecoes/manutencao";

const painel = "min-w-0 rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900";
const campo = "w-full min-w-0 rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-500/15 dark:focus:border-brand-500";
const botao = "rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:opacity-40 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800";
const curto = (v: string) => TITULOS_INSPECOES[v] ?? v;
type Resultado = { ano: string; dados: InspecaoManutencao[]; metasPorTipo?: MetaTipoInspecao[]; programacao?: ProgramacaoManutencao; erro?: string };

export default function PainelManutencao({ dadosIniciais, extracaoLocal, programacao: programacaoInicial, metasPorTipo: metasIniciais }: {
  dadosIniciais?: InspecaoManutencao[]; extracaoLocal?: string;
  programacao?: ProgramacaoManutencao; metasPorTipo?: MetaTipoInspecao[];
}) {
  const [mes, setMes] = useState("2026-10");
  const [visao, setVisao] = useState<VisaoManutencao>("mensal");
  const [concessao, setConcessao] = useState("");
  const [localizacao, setLocalizacao] = useState("");
  const [familia, setFamilia] = useState("");
  const [detalhe, setDetalhe] = useState<{ familia: string; tipo: string } | null>(null);
  const [pagina, setPagina] = useState(1);
  const [tentativa, setTentativa] = useState(0);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const ano = mes.slice(0, 4);
  const valido = /^\d{4}-(0[1-9]|1[0-2])$/.test(mes) && Number(ano) >= 1900 && Number(ano) < 9999;
  const carregando = dadosIniciais === undefined && resultado?.ano !== ano;

  useEffect(() => {
    if (dadosIniciais !== undefined || !valido) return;
    const controller = new AbortController();
    fetch(`/api/inspecoes/manutencao?ano=${encodeURIComponent(ano)}`, { cache: "no-store", signal: controller.signal })
      .then(async resposta => {
        const corpo = await resposta.json();
        if (!resposta.ok || !Array.isArray(corpo.dados) || corpo.ano !== ano) throw new Error(corpo.error ?? "Não foi possível carregar as inspeções.");
        if (!controller.signal.aborted) setResultado({ ano, dados: corpo.dados, metasPorTipo: corpo.metasPorTipo, programacao: corpo.programacao });
      }).catch(erro => {
        if (!controller.signal.aborted) setResultado({ ano, dados: [], erro: erro instanceof Error ? erro.message : "Consulta indisponível." });
      });
    return () => controller.abort();
  }, [ano, valido, tentativa, dadosIniciais]);

  const metasPorTipo = metasIniciais ?? resultado?.metasPorTipo ?? [];
  const programacao = programacaoInicial ?? resultado?.programacao;
  const dados = dadosIniciais ?? (resultado?.ano === ano ? resultado.dados : []);
  const familias = [...new Set([...FAMILIAS_MANUTENCAO, ...dados.map(d => d.familia)])];
  const concessoes = [...new Set([...dados.map(d => d.concessao), ...metasPorTipo.map(d => d.concessao)].filter((v): v is string => Boolean(v)))].sort();
  const locais = [...new Set([...dados.filter(d => !concessao || d.concessao === concessao).map(d => d.localizacao), ...metasPorTipo.filter(d => !concessao || d.concessao === concessao).map(d => d.localizacao)].filter((v): v is string => Boolean(v)))].sort();
  const mesesRecorte = valido ? mesesDoRecorte(mes, visao) : [];
  const detalhadas = useMemo(() => dados.filter(d =>
    mesesRecorte.includes(d.data_inspecao.slice(0, 7)) && (!concessao || d.concessao === concessao) &&
    (!localizacao || d.localizacao === localizacao) && (!detalhe || d.familia === detalhe.familia) &&
    (!detalhe?.tipo || d.tipo === detalhe.tipo)).sort((a, b) => b.data_inspecao.localeCompare(a.data_inspecao)),
    [dados, mesesRecorte, concessao, localizacao, detalhe]);
  const paginas = Math.max(1, Math.ceil(detalhadas.length / 10));
  const paginaAtual = Math.min(pagina, paginas);
  const periodo = !valido ? "Selecione um período" : visao === "anual" ? `Ano de ${ano}` :
    visao === "trimestral" ? `${Math.floor((Number(mes.slice(5, 7)) - 1) / 3) + 1}º trimestre de ${ano}` :
    new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(Number(ano), Number(mes.slice(5, 7)) - 1, 1)));
  const ultimaPublicacao = dados.reduce((ultima, d) => d.publicado_em > ultima ? d.publicado_em : ultima, "");
  const atualizacao = ultimaPublicacao && Number.isFinite(Date.parse(ultimaPublicacao)) ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(ultimaPublicacao)) : null;
  function abrirDetalhe(f: string, t: string) { setDetalhe({ familia: f, tipo: t }); setPagina(1); }
  function limpar() { setConcessao(""); setLocalizacao(""); setFamilia(""); setDetalhe(null); setPagina(1); }
  const metaPendente = metasPorTipo.length === 0;

  return <section aria-label="Inspeções da manutenção" className="space-y-5 text-gray-900 dark:text-gray-100">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="mb-2 text-xs font-semibold tracking-widest text-brand-600 uppercase dark:text-brand-300">Manutenção · Intranet O&M</p><h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Cada inspeção, sua meta.</h1><p className="mt-2 max-w-2xl text-sm text-gray-500 dark:text-gray-400">Acompanhe cada tipo separadamente. Os filtros abaixo atualizam todos os gráficos.</p></div>
      {dadosIniciais !== undefined && <span className="rounded-full bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700 dark:bg-brand-950 dark:text-brand-200">Prévia · dados reais</span>}
    </header>

    <div className={`${painel} p-4 md:p-5`}>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <label className="flex min-w-0 flex-col gap-1.5 text-xs font-medium text-gray-500">Visão<select value={visao} className={campo} onChange={e => { setVisao(e.target.value as VisaoManutencao); setPagina(1); }}><option value="mensal">Mensal</option><option value="trimestral">Trimestral</option><option value="anual">Anual</option></select></label>
        <label className="flex min-w-0 flex-col gap-1.5 text-xs font-medium text-gray-500">Mês de referência<input aria-label="Mês de referência" type="month" min="1900-01" max="9998-12" value={mes} className={campo} onChange={e => { setMes(e.target.value); setPagina(1); }} /></label>
        <label className="flex min-w-0 flex-col gap-1.5 text-xs font-medium text-gray-500">Concessão<select value={concessao} className={campo} onChange={e => { setConcessao(e.target.value); setLocalizacao(""); setPagina(1); }}><option value="">Todas as concessões</option>{concessoes.map(v => <option key={v}>{v}</option>)}</select></label>
        <label className="flex min-w-0 flex-col gap-1.5 text-xs font-medium text-gray-500">Localização<select value={localizacao} className={campo} onChange={e => { setLocalizacao(e.target.value); setPagina(1); }}><option value="">Todas as localizações</option>{locais.map(v => <option key={v}>{v}</option>)}</select></label>
        <label className="flex min-w-0 flex-col gap-1.5 text-xs font-medium text-gray-500">Tipo de inspeção<select value={familia} className={campo} onChange={e => { setFamilia(e.target.value); setDetalhe(null); }}><option value="">Todos os tipos</option>{familias.map(v => <option key={v} value={v}>{curto(v)}</option>)}</select></label>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p className="text-sm capitalize text-gray-500">{periodo}</p>{(concessao || localizacao || familia) && <button type="button" className="text-sm font-medium text-brand-600 dark:text-brand-300" onClick={limpar}>Limpar filtros</button>}</div>
    </div>

    {!metaPendente && <p className="text-sm leading-6 text-gray-500">Cada gráfico compara as atividades de inspeção previstas nas OS com as atividades concluídas. Os formulários preenchidos podem ser consultados em Ver inspeções.</p>}
    {metaPendente && <p role="note" className="rounded-xl bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"><strong>Metas por tipo aguardam vínculo com as atividades das OS.</strong> Os gráficos mostram as realizações reais. A meta geral do plano não foi distribuída entre os tipos de inspeção.</p>}

    {!valido ? <p role="status">Selecione um mês válido.</p> : carregando ? <p role="status" className={`${painel} p-8`}>Carregando inspeções da Manutenção…</p> : resultado?.erro && dadosIniciais === undefined ? <div role="alert" className={`${painel} p-5`}><p>{resultado.erro}</p><button type="button" className={`${botao} mt-3`} onClick={() => { setResultado(null); setTentativa(tentativa + 1); }}>Tentar novamente</button></div> : <>
      <div className="grid min-w-0 items-start gap-5 xl:grid-cols-2">
        {familias.filter(f => !familia || f === familia).map(f => <GraficoTipoInspecao key={f} familia={f} dados={dados} metas={metasPorTipo} mes={mes} visao={visao} concessao={concessao} localizacao={localizacao} onDetalhar={abrirDetalhe} />)}
      </div>
      {detalhe && <section aria-label="Detalhamento das inspeções" className={painel}>
        <div className="flex flex-wrap items-start justify-between gap-3 p-5"><div><h2 className="font-semibold">{curto(detalhe.familia)} · inspeções realizadas</h2><p className="mt-1 text-sm text-gray-500">{detalhe.tipo || "Todas as modalidades"} · {detalhadas.length.toLocaleString("pt-BR")} registros · {periodo}</p></div><button type="button" className={botao} onClick={() => setDetalhe(null)}>Fechar detalhes</button></div>
        {detalhadas.length === 0 ? <p className="px-5 pb-5 text-sm text-gray-500">Nenhum registro neste recorte.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead className="bg-gray-50 text-xs text-gray-500 dark:bg-gray-800"><tr>{["Realização", "Modalidade", "Concessão / localização", "Ativo vinculado"].map(t => <th scope="col" key={t} className="px-5 py-3 font-medium">{t}</th>)}</tr></thead><tbody>{detalhadas.slice((paginaAtual - 1) * 10, paginaAtual * 10).map(d => <tr key={`${d.id_inspecao}-${d.ficha_id}-${d.aba_id}`} className="border-t border-gray-100 dark:border-gray-800"><td className="px-5 py-3 whitespace-nowrap">{formatarDataManutencao(d.data_inspecao)}</td><td className="px-5 py-3">{d.tipo}</td><td className="px-5 py-3">{d.concessao || "Não informada"}<p className="mt-1 text-xs text-gray-500">{d.localizacao || "Não informada"}</p></td><td className="px-5 py-3">{d.ativo_id ?? "Sem vínculo"}</td></tr>)}</tbody></table></div>}
        {paginas > 1 && <nav aria-label="Paginação das inspeções" className="flex flex-wrap items-center justify-between gap-3 p-5"><p className="text-xs text-gray-500">Página {paginaAtual} de {paginas}</p><div className="flex gap-2"><button type="button" className={botao} disabled={paginaAtual === 1} onClick={() => setPagina(paginaAtual - 1)}>Anterior</button><button type="button" className={botao} disabled={paginaAtual === paginas} onClick={() => setPagina(paginaAtual + 1)}>Próxima</button></div></nav>}
      </section>}
      {programacao && <details className="text-sm text-gray-500 dark:text-gray-400"><summary className="cursor-pointer font-medium">Consultar programação geral das ordens de serviço</summary><div className="mt-4">{visao === "mensal" ? <MetasManutencao programacao={programacao} mes={mes} concessao={concessao} localizacao={localizacao} /> : <p>A programação geral de OS está disponível na visão mensal. Os gráficos acima seguem a visão selecionada.</p>}</div></details>}
      <footer className="flex flex-wrap justify-between gap-2 border-t border-gray-100 pt-4 text-xs text-gray-500 dark:border-gray-800"><span>Fonte: Intranet O&M · horários de Brasília</span><span>{extracaoLocal ? `Extração local: ${extracaoLocal}` : atualizacao ? `Última publicação: ${atualizacao}` : "Sem publicação disponível"}</span></footer>
    </>}
  </section>;
}
