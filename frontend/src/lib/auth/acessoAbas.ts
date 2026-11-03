import { resolverAbrangencia, type ModuloPortal } from './politicaAcesso.ts';
import { carregarContextoAcesso, type ClienteContextoAcesso } from './carregarContextoAcesso.ts';
export type ModuloConsulta = Exclude<ModuloPortal, 'usuarios' | 'permissoes' | 'solicitacoes_acesso'>;
export type AbasPermitidas = Partial<Record<ModuloPortal, boolean>>;
export const ABAS_POR_ROTA: Readonly<Record<string, readonly ModuloPortal[]>> = {
 "/consultas/painel-gerencial/visao-geral": ["visao_geral"],
 "/consultas/painel-gerencial/extintores": ["extintores"],
 "/consultas/painel-gerencial/ensaios": ["ensaios"],
 "/consultas/painel-gerencial/outros-indicadores": ["outros_indicadores"],
 "/consultas/programas-sso/rota-segura": ["rota_segura"],
 "/consultas/programas-sso/regras-que-salvam-vidas": ["regras_que_salvam_vidas"],
 "/consultas/programas-sso/sipat": ["sipat"],
 "/consultas/programas-sso/outros-programas": ["outros_programas"],
 '/consultas/painel-gerencial/avcb': ['avcb'],
 '/consultas/painel-gerencial/inspecoes': ['inspecoes'],
 '/consultas/painel-gerencial/planos-acao': ['planos_acao','acoes_corretivas'],
 '/consultas/painel-gerencial/motoristas': ['motoristas','motoristas_historico','motoristas_direcao','motoristas_velocidade'],
 '/gestao/usuarios': ['usuarios'], '/gestao/permissoes': ['permissoes'],
 '/gestao/solicitacoes-acesso': ['solicitacoes_acesso'],
};
export const MODULOS_CONSULTA: readonly ModuloConsulta[] = ["avcb","inspecoes","planos_acao","acoes_corretivas","motoristas","motoristas_historico","motoristas_direcao","motoristas_velocidade","visao_geral","extintores","ensaios","outros_indicadores","rota_segura","regras_que_salvam_vidas","sipat","outros_programas"];
export const ROTAS_EM_PREPARACAO: readonly string[] = [
 '/consultas/painel-gerencial/visao-geral', '/consultas/painel-gerencial/extintores',
 '/consultas/painel-gerencial/ensaios', '/consultas/painel-gerencial/outros-indicadores',
 '/consultas/programas-sso/rota-segura', '/consultas/programas-sso/regras-que-salvam-vidas',
 '/consultas/programas-sso/sipat', '/consultas/programas-sso/outros-programas',
];
export function rotaEmPreparacao(rota: string): boolean { return ROTAS_EM_PREPARACAO.includes(rota); }
export function abasDoContexto(contexto: unknown, publicado: (m: ModuloPortal) => boolean = () => true): AbasPermitidas {
 const abas: AbasPermitidas = Object.fromEntries([...MODULOS_CONSULTA,'usuarios','permissoes','solicitacoes_acesso'].map(modulo => {
  const r=resolverAbrangencia(contexto,modulo,MODULOS_CONSULTA.includes(modulo as ModuloConsulta)?'consultar':'gerenciar');
  // Nesta versao, permissoes de abas sao corporativas. Restricoes antigas nunca viram acesso amplo.
  return [modulo,publicado(modulo as ModuloPortal) && r.permitido && r.abrangencia.tipo==='corporativa'];
 }));
 return abas;
}
export function rotaPermitida(rota: string, abas: AbasPermitidas): boolean {
 return ABAS_POR_ROTA[rota]?.some(m=>abas[m]===true) ?? false;
}
export async function exigirAba(cliente: ClienteContextoAcesso, modulo: ModuloConsulta) {
 const r=await carregarContextoAcesso(cliente);
 if(!r.ok)return r;
 const permitido=abasDoContexto(r.contexto)[modulo]===true;
 return permitido ? {ok:true as const} : {ok:false as const,status:403 as const,codigo:'SEM_ACESSO_ABA'};
}
