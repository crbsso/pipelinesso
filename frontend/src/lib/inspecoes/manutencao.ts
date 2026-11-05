export type InspecaoManutencao = {
  id_inspecao: number; ficha_id: number; aba_id: number; ativo_id: number | null;
  data_inspecao: string; concessao: string | null; localizacao: string | null;
  familia: string; tipo: string; periodicidade: string | null; publicado_em: string;
};
export type FiltrosManutencao = { familia: string; tipo: string; concessao: string; localizacao: string };
export const FILTROS_VAZIOS: FiltrosManutencao = { familia: "", tipo: "", concessao: "", localizacao: "" };
export const HML_MANUTENCAO_URL = "https://ckfsarzmudwdehiiltwi.supabase.co";
export const MESES_MANUTENCAO = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
export const FAMILIAS_MANUTENCAO = [
  "Inspeção de EPIs", "Inspeção de Ferramentas e Equipamentos Rotativos",
  "Inspeção de Movimentação de Carga e Acessórios", "Inspeção de Segurança em Instalações",
  "Inspeção em Extintores de Incêndio", "Inspeção em Veículos",
] as const;
export type VisaoManutencao = "mensal" | "trimestral" | "anual";
export type PontoManutencao = { rotulo: string; total: number | null; mesesComDados: number; mesesEsperados: number };

export function periodoAno(ano: string): { inicio: string; fim: string } | null {
  if (!/^\d{4}$/.test(ano) || Number(ano) < 1900 || Number(ano) > 9998) return null;
  return { inicio: `${ano}-01-01`, fim: `${Number(ano) + 1}-01-01` };
}

export function indicesPeriodoManutencao(visao: VisaoManutencao, referencia: number) {
  if (visao === "anual") return Array.from({ length: 12 }, (_, i) => i);
  if (visao === "trimestral") return Array.from({ length: 3 }, (_, i) => Math.floor(referencia / 3) * 3 + i);
  return [referencia];
}

export function filtrarPeriodoManutencao(dados: readonly InspecaoManutencao[], ano: string, visao: VisaoManutencao, referencia: number) {
  const meses = new Set(indicesPeriodoManutencao(visao, referencia).map(i => `${ano}-${String(i + 1).padStart(2, "0")}`));
  // Competencia da realizacao no horario local da origem, sem conversao de fuso.
  return dados.filter(item => meses.has(item.data_inspecao.slice(0, 7)));
}

export function serieMensalManutencao(dadosFiltrados: readonly InspecaoManutencao[], dadosPublicados: readonly InspecaoManutencao[], ano: string): PontoManutencao[] {
  const mesesPublicados = new Set(dadosPublicados.map(item => item.data_inspecao.slice(0, 7)));
  const totais = new Map<string, number>();
  for (const item of dadosFiltrados) {
    const mes = item.data_inspecao.slice(0, 7);
    totais.set(mes, (totais.get(mes) ?? 0) + 1);
  }
  return MESES_MANUTENCAO.map((rotulo, indice) => {
    const mes = `${ano}-${String(indice + 1).padStart(2, "0")}`;
    const disponivel = mesesPublicados.has(mes);
    return { rotulo, total: disponivel ? totais.get(mes) ?? 0 : null, mesesComDados: Number(disponivel), mesesEsperados: 1 };
  });
}

export function seriePorVisaoManutencao(meses: readonly PontoManutencao[], visao: VisaoManutencao): PontoManutencao[] {
  if (visao === "trimestral") return Array.from({ length: 4 }, (_, indice) => {
    const grupo = meses.slice(indice * 3, indice * 3 + 3);
    const presentes = grupo.filter(item => item.total !== null);
    return { rotulo: `${indice + 1}º tri`, total: presentes.length ? presentes.reduce((soma, item) => soma + item.total!, 0) : null, mesesComDados: presentes.length, mesesEsperados: 3 };
  });
  if (visao === "anual") {
    let acumulado = 0;
    let mesesComDados = 0;
    return meses.map((item, indice) => {
      if (item.total !== null) { acumulado += item.total; mesesComDados++; }
      return { rotulo: item.rotulo, total: item.total === null ? null : acumulado, mesesComDados, mesesEsperados: indice + 1 };
    });
  }
  return [...meses];
}

export function periodoMes(mes: string): { inicio: string; fim: string } | null {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) return null;
  const [ano, numero] = mes.split("-").map(Number);
  if (ano < 1900 || ano > 9998) return null;
  return { inicio: `${mes}-01`, fim: numero === 12 ? `${ano + 1}-01-01` : `${ano}-${String(numero + 1).padStart(2, "0")}-01` };
}
export function filtrarManutencao(dados: readonly InspecaoManutencao[], filtros: FiltrosManutencao) {
  return dados.filter(item => (Object.keys(filtros) as (keyof FiltrosManutencao)[])
    .every(campo => !filtros[campo] || item[campo] === filtros[campo]));
}
export function resumirManutencao(dados: readonly InspecaoManutencao[]) {
  const familias = new Map<string, number>();
  for (const item of dados) familias.set(item.familia, (familias.get(item.familia) ?? 0) + 1);
  return {
    total: dados.length,
    ativos: new Set(dados.flatMap(item => item.ativo_id === null ? [] : [item.ativo_id])).size,
    tipos: new Set(dados.map(item => JSON.stringify([item.familia, item.tipo]))).size,
    familias: [...familias].map(([familia, total]) => ({ familia, total })).sort((a, b) => b.total - a.total || a.familia.localeCompare(b.familia, "pt-BR")),
  };
}
// O SQL guarda horario local sem fuso; nao converter pelo fuso do navegador.
export function formatarDataManutencao(valor: string) {
  const partes = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(valor);
  return partes ? `${partes[3]}/${partes[2]}/${partes[1]} ${partes[4]}:${partes[5]}` : "—";
}
