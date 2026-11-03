import { createClient } from "@/lib/supabase/server";
import { carregarContextoAcesso } from "@/lib/auth/carregarContextoAcesso";
import { resolverAbrangencia } from "@/lib/auth/politicaAcesso";
import { jsonGestao } from "@/lib/gestao/http";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const r = await carregarContextoAcesso(await createClient());
    if (!r.ok) return jsonGestao({ error: "Não foi possível carregar as permissões de gestão." }, r.status);
    return jsonGestao(Object.fromEntries(["usuarios", "permissoes", "solicitacoes_acesso"].map(modulo => [
      modulo, resolverAbrangencia(r.contexto, modulo, "gerenciar").permitido])));
  } catch { return jsonGestao({ error: "Gestão indisponível." }, 503); }
}
