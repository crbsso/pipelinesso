import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/requirePermission";
import type { ModuloGestao } from "@/lib/gestao/http";
export default async function ProtecaoGestao({ modulo, children }: { modulo: ModuloGestao; children: React.ReactNode ;}) {
  const acesso = await requirePermission(await createClient(), modulo, "gerenciar");
  if (!acesso.ok) {
    if (acesso.status === 401) redirect("/signin");
    return <section role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
      <h1 className="text-xl font-semibold">{acesso.status === 503 ? "Gestão indisponível" : "Acesso não permitido"}</h1>
      <p className="mt-2">{acesso.status === 503 ? "Não foi possível validar suas permissões. Tente novamente mais tarde." :
        "Sua conta não tem uma concessão ativa para esta área. Solicite uma revisão ao administrador do portal."}</p>
    </section>;
  }
  return <>{children}</>;
}
