import { createClient } from "@/lib/supabase/server";
import { analisarSolicitacao } from "@/lib/gestao/solicitacoes";
import { criarAdminConvites } from "@/lib/gestao/convitesServidor";
export const dynamic = "force-dynamic";
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return analisarSolicitacao(request, id, createClient, criarAdminConvites, process.env.PORTAL_SSO_ORIGIN);
}
