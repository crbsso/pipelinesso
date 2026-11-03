import { createClient } from '../supabase/server';
import { carregarContextoAcesso } from './carregarContextoAcesso';
import { abasDoContexto, exigirAba, type ModuloConsulta } from './acessoAbas';
import type { ModuloPortal } from './politicaAcesso';
export const CABECALHOS_ACESSO = {'Cache-Control':'private, no-store, max-age=0',Vary:'Cookie'};
export function recursoPublicado(modulo: ModuloPortal): boolean {
 if(process.env.NODE_ENV==='development')return true;
 const flags: Partial<Record<ModuloPortal,string|undefined>>={motoristas_historico:process.env.SSO_MOTORISTAS_HISTORICO_ENABLED,motoristas_direcao:process.env.SSO_MOTORISTAS_DIRECAO_ENABLED,motoristas_velocidade:process.env.SSO_MOTORISTAS_APIS_ENABLED};
 return !(modulo in flags)||flags[modulo]==='true';
}
export async function carregarAbas() {
 try {
  const r=await carregarContextoAcesso(await createClient());
  return r.ok ? {ok:true as const,abas:abasDoContexto(r.contexto,recursoPublicado)} : r;
 } catch {return {ok:false as const,status:503 as const,codigo:'AUTORIZACAO_INDISPONIVEL'};}
}
export async function autorizarConsulta(modulo: ModuloConsulta): Promise<Response|null> {
 try {
  const r=await exigirAba(await createClient(),modulo);
  if(!r.ok)return Response.json({error:r.status===401?'Entre para continuar.':r.status===503?'Não foi possível validar suas permissões.':'Sua conta não tem acesso a esta aba.'},{status:r.status,headers:CABECALHOS_ACESSO});
  if(!recursoPublicado(modulo))return Response.json({error:'Recurso em validação.'},{status:404,headers:CABECALHOS_ACESSO});
  if(process.env.SUPABASE_URL && process.env.SUPABASE_URL!==process.env.NEXT_PUBLIC_SUPABASE_URL)return Response.json({error:'Configuração indisponível.'},{status:503,headers:CABECALHOS_ACESSO});
  return null;
 } catch {return Response.json({error:'Não foi possível validar suas permissões.'},{status:503,headers:CABECALHOS_ACESSO});}
}
