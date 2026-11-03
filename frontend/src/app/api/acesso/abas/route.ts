import { carregarAbas, CABECALHOS_ACESSO } from '@/lib/auth/abasServidor';
export const dynamic='force-dynamic';
export async function GET(){const r=await carregarAbas();return Response.json(r.ok?r.abas:{error:'Não foi possível validar suas permissões.'},{status:r.ok?200:r.status,headers:CABECALHOS_ACESSO});}
