import "server-only";
import { createClient } from "@supabase/supabase-js";
export function criarAdminConvites() {
  const url = process.env.SUPABASE_URL;
  const segredo = process.env.SUPABASE_SECRET_KEY;
  if (!url || !segredo || url !== process.env.NEXT_PUBLIC_SUPABASE_URL)
    throw new Error("Configuração do serviço de convites indisponível.");
  const cliente = createClient(url, segredo, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, flowType: "implicit" },
  });
  return {
    createUser: cliente.auth.admin.createUser.bind(cliente.auth.admin),
    inviteUserByEmail: cliente.auth.admin.inviteUserByEmail.bind(cliente.auth.admin),
    resetPasswordForEmail: cliente.auth.resetPasswordForEmail.bind(cliente.auth),
  };
}
