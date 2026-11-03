import type { ModuloPortal, AcaoPortal } from "../auth/politicaAcesso";
export type Capacidade = { modulo: ModuloPortal; acao: AcaoPortal; ativo?: boolean ;};
export type Perfil = { id: string; codigo: string; nome: string; descricao: string; ativo: boolean; versao: string; usuarios_vinculados: number; capacidades: Capacidade[] ;};
export type Usuario = { usuario_id: string; email: string; confirmado: boolean; ativo: boolean; cadastrado: boolean; papel_legado: string | null; versao: string | null ;};
export type Escopo = { modulo: ModuloPortal; acao: AcaoPortal; tipo: "corporativa" | "restrita"; unidades: Record<string, string>[] ;};
export type Atribuicao = { herdar_perfil?: boolean; id: string; user_id: string; perfil_id: string; perfil_nome: string; perfil: Perfil; ativo: boolean; inicio: string | null; fim: string | null; abrangencias: Escopo[]; versao: string ;};
export type Pagina<T> = { dados: T[]; total: number; pagina: number; limite: number ;};
export type Auditoria = { id: string; ocorrido_em: string; autor: string; alvo: string | null; entidade: string; operacao: string; perfil_atual_id?: string | null; antes: unknown; depois: unknown ;};
export const RECURSOS_GESTAO: Record<ModuloPortal, { nome: string; acao: AcaoPortal; campos: Record<string, string>; emPreparacao?: boolean ;}> = {
  visao_geral: { nome: "Visão Geral", acao: "consultar", campos: {}, emPreparacao: true },
  extintores: { nome: "Extintores", acao: "consultar", campos: {}, emPreparacao: true },
  ensaios: { nome: "Ensaios", acao: "consultar", campos: {}, emPreparacao: true },
  outros_indicadores: { nome: "Outros Indicadores", acao: "consultar", campos: {}, emPreparacao: true },
  rota_segura: { nome: "Rota Segura", acao: "consultar", campos: {}, emPreparacao: true },
  regras_que_salvam_vidas: { nome: "Regras que Salvam Vidas", acao: "consultar", campos: {}, emPreparacao: true },
  sipat: { nome: "SIPAT", acao: "consultar", campos: {}, emPreparacao: true },
  outros_programas: { nome: "Outros Programas", acao: "consultar", campos: {}, emPreparacao: true },
  avcb: { nome: "AVCB", acao: "consultar", campos: { projeto: "Projeto", subestacao: "Subestação", instalacao: "Instalação" } },
  inspecoes: { nome: "Inspeções", acao: "consultar", campos: { area_organizacional: "Área organizacional", local: "Local", empresa_colaborador: "Empresa", setor_colaborador: "Setor" } },
  planos_acao: { nome: "Planos de Ação", acao: "consultar", campos: { nivel_organizacional: "Nível organizacional", grupo_sso: "Grupo SSO" } },
  acoes_corretivas: { nome: "Ações Corretivas", acao: "consultar", campos: { nivel_organizacional: "Nível organizacional", grupo_sso: "Grupo SSO" } },
  motoristas: { nome: "Motoristas", acao: "consultar", campos: { coligada: "Coligada", secao_rm: "Seção RM" } },
  motoristas_historico: { nome: "Histórico de Motoristas", acao: "consultar", campos: { coligada: "Coligada", secao_rm: "Seção RM" } },
  motoristas_direcao: { nome: "Direção", acao: "consultar", campos: { coligada: "Coligada", secao_rm: "Seção RM" } },
  motoristas_velocidade: { nome: "Velocidade", acao: "consultar", campos: { coligada: "Coligada", secao_rm: "Seção RM" } },
  usuarios: { nome: "Gestão de usuários", acao: "gerenciar", campos: {} },
  permissoes: { nome: "Gestão de permissões", acao: "gerenciar", campos: {} },
  solicitacoes_acesso: { nome: "Análise de solicitações", acao: "gerenciar", campos: {} },
};
export function formatarInstante(valor: string | null) {
  return valor ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(valor)) : "Sem limite";
}
