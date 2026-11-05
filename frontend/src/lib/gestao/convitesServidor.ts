import "server-only";
import { createClient } from "@supabase/supabase-js";
export function criarAdminConvites() {
  const url = process.env.SUPABASE_URL;
  const segredo = process.env.SUPABASE_SECRET_KEY;
  if (!url || !segredo || url !== process.env.NEXT_PUBLIC_SUPABASE_URL)
    throw new Error("Configuração do serviço de convites indisponível.");
  return createClient(url, segredo, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  }).auth.admin;
}
