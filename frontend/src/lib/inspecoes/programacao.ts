import type { InspecaoManutencao } from "./manutencao.ts";

export type OrdemProgramada = {
  os_id: number; plano_id: number; concessao: string | null; localizacao: string | null;
  equipamento_id: number | null; data_prevista: string; data_original: string | null;
  data_final_real: string | null; estagio: string;
};
export type ProgramacaoManutencao = {
  inicio: string; fim_exclusivo: string; fim_realizacoes_exclusivo: string;
  ordens: OrdemProgramada[];
  vinculos: { id_inspecao: number; ficha_id: number; aba_id: number; os_id: number | null; data_inspecao: string }[];
};
export type AtividadeProgramada = { atividade_os_id: number; os_id: number; atividade_id: number; status: number };
export type MetaTipoInspecao = {
  mes: string; familia: string; tipo: string; concessao: string; localizacao: string;
  quantidade: number; realizadas: number; outrosEstados: number; unidade: "atividades_os"; fonte: string; validada: true;
};
export const FAMILIAS_ATIVIDADES: Readonly<Record<number, string>> = {
  7911: "Inspeção de EPIs",
  7913: "Inspeção de Movimentação de Carga e Acessórios",
  7915: "Inspeção de Ferramentas e Equipamentos Rotativos",
  7917: "Inspeção de Segurança em Instalações",
  7918: "Inspeção em Extintores de Incêndio",
  7919: "Inspeção em Veículos",
};
export function construirMetas(programacao: ProgramacaoManutencao, atividades: AtividadeProgramada[]): MetaTipoInspecao[] {
  const ordens = new Map<number, OrdemProgramada>();
  for (const o of programacao.ordens) {
    if (ordens.has(o.os_id)) throw Error("OS duplicada na programação.");
    ordens.set(o.os_id, o);
  }
  const metas = new Map<string, MetaTipoInspecao>();
  const chave = (o: OrdemProgramada, familia: string) => JSON.stringify([o.data_prevista.slice(0, 7), familia, o.concessao ?? "", o.localizacao ?? ""]);
  for (const o of ordens.values()) {
    if (o.plano_id !== 197) continue;
    for (const familia of Object.values(FAMILIAS_ATIVIDADES)) {
      const id = chave(o, familia);
      if (!metas.has(id)) metas.set(id, { mes: o.data_prevista.slice(0, 7), familia,
        tipo: familia === FAMILIAS_ATIVIDADES[7911] ? "Cinto de segurança" : familia === FAMILIAS_ATIVIDADES[7913] ? "Acessórios" : "",
        concessao: o.concessao ?? "", localizacao: o.localizacao ?? "", quantidade: 0, realizadas: 0,
        outrosEstados: 0, unidade: "atividades_os", fonte: "PE-017 · ListaAtividadeOrdemServicoAtividade", validada: true });
    }
  }
  const vistos = new Set<number>();
  const obrigacoes = new Set<string>();
  for (const a of atividades) {
    if (vistos.has(a.atividade_os_id)) throw Error("Atividade duplicada.");
    vistos.add(a.atividade_os_id);
    const o = ordens.get(a.os_id);
    if (!o || o.plano_id !== 197 || !FAMILIAS_ATIVIDADES[a.atividade_id]) throw Error("Atividade fora da programação aprovada.");
    const key = JSON.stringify([a.os_id, a.atividade_id]);
    if (obrigacoes.has(key)) throw Error("Mais de uma obrigação para a mesma OS e atividade.");
    obrigacoes.add(key);
    const meta = metas.get(chave(o, FAMILIAS_ATIVIDADES[a.atividade_id]))!;
    meta.quantidade++;
    if (a.status === 2) meta.realizadas++;
    else if (a.status !== 1) meta.outrosEstados++;
  }
  return [...metas.values()];
}
export type CargaMensalManutencao = {
  competencia: string; extraido_em: string; publicado_em?: string;
  conteudo: { versao: number; origem: string; dados: InspecaoManutencao[];
    programacao: ProgramacaoManutencao; atividades: AtividadeProgramada[] };
};
export function consolidarCargas(cargas: CargaMensalManutencao[]) {
  const dados: InspecaoManutencao[] = [], atividades: AtividadeProgramada[] = [];
  const programacao: ProgramacaoManutencao = { inicio: "", fim_exclusivo: "", fim_realizacoes_exclusivo: "", ordens: [], vinculos: [] };
  const competencias = new Set<string>();
  for (const carga of [...cargas].sort((a, b) => a.competencia.localeCompare(b.competencia))) {
    if (competencias.has(carga.competencia)) throw Error("Competência duplicada.");
    competencias.add(carga.competencia);
    const c = carga.conteudo;
    if (c.versao !== 1 || c.origem !== "SQL Server Intranet" || !Array.isArray(c.dados) || !Array.isArray(c.atividades)) throw Error("Carga inválida.");
    if (c.programacao.inicio !== carga.competencia) throw Error("Cobertura mensal divergente.");
    if (!programacao.inicio) programacao.inicio = c.programacao.inicio;
    programacao.fim_exclusivo = c.programacao.fim_exclusivo;
    programacao.fim_realizacoes_exclusivo = [programacao.fim_realizacoes_exclusivo, c.programacao.fim_realizacoes_exclusivo].sort().at(-1)!;
    dados.push(...c.dados.map(d => ({ ...d, publicado_em: carga.publicado_em ?? carga.extraido_em })));
    programacao.ordens.push(...c.programacao.ordens);
    programacao.vinculos.push(...c.programacao.vinculos);
    atividades.push(...c.atividades);
  }
  return { dados, programacao, metasPorTipo: construirMetas(programacao, atividades) };
}
