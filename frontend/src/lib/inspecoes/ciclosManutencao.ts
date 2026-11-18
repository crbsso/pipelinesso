import type { InspecaoManutencao } from "./manutencao.ts";

export type PeriodicidadeCiclo = "Mensal" | "Bimestral" | "Trimestral" | "Conforme demanda";
export type RegraCiclo = {
  id: string; familia: string; nome: string; ficha: number; abas?: readonly number[];
  excluirAbas?: readonly number[]; periodicidade: PeriodicidadeCiclo; unidade: string;
  exigeRecorte?: boolean; observacao?: string;
};
export const REGRAS_CICLOS: readonly RegraCiclo[] = [
  { id: "inst", familia: "Instalações", nome: "Segurança em instalações", ficha: 1, periodicidade: "Trimestral", unidade: "Local" },
  { id: "ext", familia: "Extintores", nome: "Extintores de incêndio", ficha: 13, periodicidade: "Mensal", unidade: "Local" },
  { id: "veic", familia: "Veículos", nome: "Veículos de rotina", ficha: 11, abas: [106,107,108,246,384,496], periodicidade: "Mensal", unidade: "Veículo da rotina mensal", observacao: "Retirada e devolução ficam separadas da rotina mensal." },
  { id: "ferr-eat", familia: "Ferramentas e rotativos", nome: "Ferramentas — EAT", ficha: 18, periodicidade: "Trimestral", unidade: "Instalação do grupo EAT", exigeRecorte: true },
  { id: "ferr-lt", familia: "Ferramentas e rotativos", nome: "Ferramentas — LT", ficha: 18, periodicidade: "Trimestral", unidade: "Instalação do grupo LT", exigeRecorte: true, observacao: "Uma mesma instalação pode aparecer nos grupos EAT e LT. Somar os grupos pode contar o mesmo local duas vezes." },
  { id: "carga-148", familia: "Carga e acessórios", nome: "Movimentação de carga", ficha: 15, abas: [148], periodicidade: "Mensal", unidade: "Instalação" },
  { id: "carga-149", familia: "Carga e acessórios", nome: "Acessórios de içamento", ficha: 15, abas: [149], periodicidade: "Bimestral", unidade: "Instalação" },
  { id: "epi-150", familia: "EPIs", nome: "Cintos de segurança", ficha: 16, abas: [150], periodicidade: "Trimestral", unidade: "Pessoa usuária do EPI", observacao: "Ainda precisamos confirmar quem usa cada cinto, quem entra na meta e se a inspeção de um produto novo conta para a meta trimestral." },
  { id: "epi-151", familia: "EPIs", nome: "Uso de EPIs em atividade", ficha: 16, abas: [151], periodicidade: "Bimestral", unidade: "A confirmar com os responsáveis" },
  { id: "epi-467", familia: "EPIs", nome: "Capacete", ficha: 16, abas: [467], periodicidade: "Conforme demanda", unidade: "Sem meta fixa; inspeção conforme necessidade" },
  { id: "epi-468", familia: "EPIs", nome: "Inspeção bimestral em EPIs", ficha: 16, abas: [468], periodicidade: "Bimestral", unidade: "A confirmar com os responsáveis", observacao: "A inspeção deve ocorrer a cada dois meses, mesmo que o cadastro indique conforme demanda." },
  ...[{ id: 152, nome: "Obras civis" }, { id: 153, nome: "Brigada (BM Uberlândia)" }, { id: 154, nome: "SSO" }, { id: 248, nome: "Uso de EPIs em atividade — SSO" }].map(a => ({ id: `sso-${a.id}`, familia: "Inspeções de SSO", nome: a.nome, ficha: 17, abas: [a.id], periodicidade: "Conforme demanda" as const, unidade: "Sem meta fixa; inspeção conforme necessidade" })),
];
export const COLIGADAS_CICLOS = [
  ["1","CRB"],["2","PTE"],["3","CTE"],["4","ENTE"],["6","LTC"],["7","IMTE"],["9","CANTE"],["10","JTE"],["11","VCTE"],["14","BTE"],["16","SITE"],["17","CRTR"],["24","CRTE"],["26","CPTE"],["28","PATE"],
].map(([id, sigla]) => ({ id, sigla }));
export const FAMILIAS_CICLOS = [...new Set(REGRAS_CICLOS.map(r => r.familia))];
export const TAMANHO_PAGINA_CICLOS = 10;

export type UnidadeCiclo = {
  chave: string; nome: string; concessao: string | null; localizacao: string | null;
  grupo: string | null; registros: number; com_respostas: boolean | null;
};
export type PosicaoCiclo = {
  regra_id: string; data_corte: string; inicio_ciclo: string | null; fim_ciclo: string | null;
  registros: number; unidades_no_recorte: number | null; unidades_com_registro: number | null;
  unidades_com_respostas: number | null; populacao: "provisoria" | "homologada" | "nao_definida";
  detalhe: "completo" | "somente_sem_registro" | "nao_carregado"; unidades: UnidadeCiclo[]; fonte: string;
};
export type MesCarregado = { mes: string; data_corte: string; fichas: number[] };
export type FiltrosCiclo = { mes: string; regra: string; coligada: string; local: string; grupo: string };
export type ResumoCiclo = {
  regra: RegraCiclo; inicio: string | null; fim: string | null; corte: string | null;
  registros: number | null; registrosMes: number | null; populacao: number | null;
  comRegistro: number | null; semRegistro: number | null; comRespostas: number | null;
  unidades: UnidadeCiclo[]; populacaoStatus: PosicaoCiclo["populacao"]; parcial: boolean;
  motivo: string | null; fonte: string | null;
};
const mesValido = (m: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(m) && Number(m.slice(0,4)) >= 1900 && Number(m.slice(0,4)) <= 9998;
const dataValida = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().slice(0,10) === s;
const inteiro = (n: unknown): n is number => typeof n === "number" && Number.isSafeInteger(n) && n >= 0;
const texto = (s: unknown): s is string => typeof s === "string" && s.length <= 1000;
const textoOpcional = (s: unknown): s is string | null => s === null || texto(s);
export function cicloDaRegra(regra: RegraCiclo, mes: string) {
  if (!mesValido(mes)) return null;
  const [ano, numero] = mes.split("-").map(Number);
  const tamanho = regra.periodicidade === "Mensal" ? 1 : regra.periodicidade === "Bimestral" ? 2 : regra.periodicidade === "Trimestral" ? 3 : 0;
  if (!tamanho) return { inicio: null, fim: null };
  const primeiro = Math.floor((numero-1)/tamanho)*tamanho;
  const inicio = `${ano}-${String(primeiro+1).padStart(2,"0")}-01`;
  const ultimoDia = new Date(Date.UTC(ano, primeiro+tamanho, 0)).getUTCDate();
  return { inicio, fim: `${ano}-${String(primeiro+tamanho).padStart(2,"0")}-${ultimoDia}` };
}
export function coligadaDaConcessao(concessao: string | null) {
  return COLIGADAS_CICLOS.find(c => c.sigla === concessao?.trim())?.id ?? "sem_correspondencia";
}
export function correspondeColigada(concessao: string | null, filtro: string) {
  return !filtro || coligadaDaConcessao(concessao) === filtro;
}
function exigir(condicao: unknown, mensagem: string): asserts condicao { if (!condicao) throw Error(mensagem); }
export function validarPosicoesCiclo(valor: unknown, competencia: string): PosicaoCiclo[] {
  if (valor === undefined) return [];
  exigir(Array.isArray(valor) && valor.length <= REGRAS_CICLOS.length, "Posições de ciclo inválidas.");
  const vistos = new Set<string>();
  for (const p of valor as PosicaoCiclo[]) {
    exigir(p && typeof p === "object", "Posição de ciclo inválida.");
    const regra = REGRAS_CICLOS.find(r => r.id === p.regra_id);
    exigir(regra && !vistos.has(p.regra_id), "Regra de ciclo ausente ou duplicada."); vistos.add(p.regra_id);
    exigir(dataValida(p.data_corte) && `${p.data_corte.slice(0,7)}-01` === competencia, "Data de corte fora da competência.");
    const ciclo = cicloDaRegra(regra, p.data_corte.slice(0,7))!;
    exigir(p.inicio_ciclo === ciclo.inicio && p.fim_ciclo === ciclo.fim, "Ciclo divergente da regra aprovada.");
    exigir(inteiro(p.registros), "Quantidade de registros inválida.");
    exigir((p.unidades_no_recorte === null && p.unidades_com_registro === null) || (inteiro(p.unidades_no_recorte) && inteiro(p.unidades_com_registro) && p.unidades_com_registro <= p.unidades_no_recorte), "População e atendimento inconsistentes.");
    exigir(p.unidades_com_respostas === null || (inteiro(p.unidades_com_respostas) && p.unidades_com_registro !== null && p.unidades_com_respostas <= p.unidades_com_registro), "Respostas fora da cobertura.");
    exigir(["provisoria","homologada","nao_definida"].includes(p.populacao) && ["completo","somente_sem_registro","nao_carregado"].includes(p.detalhe), "Estado da população inválido.");
    exigir((p.unidades_no_recorte === null) === (p.populacao === "nao_definida"), "População desconhecida não pode ser homologada.");
    exigir(Array.isArray(p.unidades) && p.unidades.length <= 20000 && texto(p.fonte) && p.fonte.trim(), "Unidades ou fonte inválidas.");
    const chaves = new Set<string>();
    for (const u of p.unidades) {
      exigir(u && texto(u.chave) && u.chave.trim() && !chaves.has(u.chave), "Unidade ausente ou duplicada."); chaves.add(u.chave);
      exigir(texto(u.nome) && u.nome.trim() && textoOpcional(u.concessao) && textoOpcional(u.localizacao) && textoOpcional(u.grupo) && inteiro(u.registros), "Unidade de ciclo inválida.");
      exigir(u.com_respostas === null || typeof u.com_respostas === "boolean", "Indicador de respostas inválido.");
      exigir(u.registros > 0 || u.com_respostas !== true, "Resposta sem registro.");
    }
    if (p.detalhe === "completo") {
      exigir(p.unidades_no_recorte === p.unidades.length && p.unidades_com_registro === p.unidades.filter(u => u.registros > 0).length && p.registros === p.unidades.reduce((s,u) => s+u.registros,0), "População individual não concilia com o agregado.");
      if (p.unidades_com_respostas !== null) exigir(p.unidades_com_respostas === p.unidades.filter(u => u.com_respostas === true).length, "Respostas individuais não conciliam.");
    } else if (p.detalhe === "somente_sem_registro") {
      exigir(p.unidades_no_recorte !== null && p.unidades_com_registro !== null && p.unidades.length === p.unidades_no_recorte-p.unidades_com_registro && p.unidades.every(u => u.registros === 0), "Lista sem registro não concilia.");
    } else exigir(p.unidades.length === 0, "Detalhamento não carregado deve estar vazio.");
  }
  return valor as PosicaoCiclo[];
}
export function filtrarUnidadesCiclo(unidades: readonly UnidadeCiclo[], filtros: FiltrosCiclo) {
  return unidades.filter(u => correspondeColigada(u.concessao,filtros.coligada) && (!filtros.local || u.chave === filtros.local || u.localizacao === filtros.local) && (!filtros.grupo || u.grupo === filtros.grupo));
}
export function pertenceRegra(d: InspecaoManutencao, r: RegraCiclo) {
  return d.ficha_id === r.ficha && (!r.abas || r.abas.includes(d.aba_id)) && !r.excluirAbas?.includes(d.aba_id);
}
export function filtrarRegistrosCiclo(dados: readonly InspecaoManutencao[], regra: RegraCiclo, filtros: FiltrosCiclo, inicio: string, fim: string) {
  if (regra.exigeRecorte || filtros.grupo) return [];
  const vistos = new Set<number>();
  return dados.filter(d => {
    if (!pertenceRegra(d,regra) || d.data_inspecao.slice(0,10) < inicio || d.data_inspecao.slice(0,10) > fim || !correspondeColigada(d.concessao,filtros.coligada) || (filtros.local && d.localizacao !== filtros.local) || vistos.has(d.id_inspecao)) return false;
    vistos.add(d.id_inspecao); return true;
  });
}
export function resumirCiclo(dados: readonly InspecaoManutencao[], posicoes: readonly PosicaoCiclo[], meses: readonly MesCarregado[], filtros: FiltrosCiclo): ResumoCiclo | null {
  const regra = REGRAS_CICLOS.find(r => r.id === filtros.regra), ciclo = regra && cicloDaRegra(regra,filtros.mes);
  if (!regra || !ciclo) return null;
  const base: ResumoCiclo = { regra, ...ciclo, corte: null, registros: null, registrosMes: null, populacao: null, comRegistro: null, semRegistro: null, comRespostas: null, unidades: [], populacaoStatus: "nao_definida", parcial: false, motivo: null, fonte: null };
  const posicao = posicoes.find(p => p.regra_id === regra.id && p.data_corte.slice(0,7) === filtros.mes);
  const escopo = Boolean(filtros.coligada || filtros.local || filtros.grupo);
  const ultimoDiaMes = cicloDaRegra({...regra,periodicidade:"Mensal"},filtros.mes)!.fim!;
  const mes = meses.find(m => m.mes === filtros.mes && m.fichas.includes(regra.ficha));
  if (mes && !regra.exigeRecorte && !filtros.grupo) base.registrosMes = filtrarRegistrosCiclo(dados,regra,filtros,`${filtros.mes}-01`,mes.data_corte).length;
  if (posicao) {
    base.corte = posicao.data_corte; base.fonte = posicao.fonte; base.populacaoStatus = posicao.populacao;
    base.unidades = filtrarUnidadesCiclo(posicao.unidades,filtros);
    if (filtros.coligada && filtros.coligada !== "sem_correspondencia" && posicao.unidades.some(u=>u.concessao===null)) {
      base.registrosMes = null; base.populacaoStatus = "nao_definida";
      base.motivo = "Ainda não sabemos a qual coligada pertencem alguns locais, veículos ou pessoas. Por isso, não é possível mostrar um total confiável para a coligada selecionada.";
      return base;
    }
    const localComprovado = Boolean(filtros.local) && posicao.detalhe === "somente_sem_registro" && base.unidades.length > 0;
    if (escopo && posicao.detalhe !== "completo" && !localComprovado) {
      base.motivo = "A lista de quem precisa de inspeção ainda não está completa para os filtros selecionados.";
      base.populacaoStatus = "nao_definida"; return base;
    }
    if (escopo) {
      base.populacao = base.unidades.length; base.comRegistro = base.unidades.filter(u=>u.registros>0).length;
      base.semRegistro = base.populacao-base.comRegistro; base.registros = base.unidades.reduce((s,u)=>s+u.registros,0);
      base.comRespostas = base.unidades.every(u=>u.com_respostas!==null) ? base.unidades.filter(u=>u.com_respostas).length : null;
    } else {
      base.registros = posicao.registros; base.populacao = posicao.unidades_no_recorte; base.comRegistro = posicao.unidades_com_registro;
      base.semRegistro = base.populacao === null || base.comRegistro === null ? null : base.populacao-base.comRegistro;
      base.comRespostas = posicao.unidades_com_respostas;
    }
    if (regra.periodicidade === "Mensal") base.registrosMes = base.registros;
    return base;
  }
  if (regra.exigeRecorte || filtros.grupo) { base.motivo = regra.exigeRecorte ? "Os dados de instalações dos grupos EAT e LT ainda não estão disponíveis para o mês selecionado." : "Ainda não temos a identificação dos veículos de cada grupo para o mês selecionado."; return base; }
  const inicio = ciclo.inicio ?? `${filtros.mes}-01`, fim = ciclo.fim ?? ultimoDiaMes;
  const cobertos = meses.filter(m => m.mes >= inicio.slice(0,7) && m.mes <= filtros.mes && m.fichas.includes(regra.ficha));
  const corte = cobertos.map(m=>m.data_corte).sort().at(-1);
  if (!corte) { base.motivo = "Os dados ainda não estão disponíveis para o mês e os filtros selecionados."; return base; }
  base.corte = corte; base.registros = filtrarRegistrosCiclo(dados,regra,filtros,inicio,corte < fim ? corte : fim).length;
  const esperados = (Number(filtros.mes.slice(0,4))-Number(inicio.slice(0,4)))*12+Number(filtros.mes.slice(5,7))-Number(inicio.slice(5,7))+1;
  base.parcial = cobertos.length < esperados || corte < ultimoDiaMes;
  base.motivo = "A lista de quem precisa de inspeção neste período ainda não está disponível.";
  return base;
}
export function paginarCiclo<T>(linhas: readonly T[], pagina: number) {
  const paginas = Math.max(1,Math.ceil(linhas.length/TAMANHO_PAGINA_CICLOS));
  const atual = Math.min(Math.max(1,Number.isFinite(pagina)?Math.trunc(pagina):1),paginas);
  const inicio = (atual-1)*TAMANHO_PAGINA_CICLOS;
  return { pagina: atual, paginas, inicio, fim: Math.min(inicio+TAMANHO_PAGINA_CICLOS,linhas.length), linhas: linhas.slice(inicio,inicio+TAMANHO_PAGINA_CICLOS) };
}
export function textoBuscaCiclo(s: string) { return s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("pt-BR"); }
export function celulaCsvCiclo(valor: string | number | null) {
  let s = valor === null ? "" : String(valor); if (/^\s*[=+@-]/.test(s)) s = "'"+s;
  return `"${s.replace(/"/g,'""')}"`;
}
