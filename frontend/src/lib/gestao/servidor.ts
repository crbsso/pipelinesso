import { createClient } from "@/lib/supabase/server";
import { executarGestao } from "./http";
export function rotaGestao(request: Request, config: Parameters<typeof executarGestao>[1]) {
  return executarGestao(request, config, createClient, process.env.PORTAL_SSO_ORIGIN);
}
