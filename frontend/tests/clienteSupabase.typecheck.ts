import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClienteContextoAcesso } from "../src/lib/auth/carregarContextoAcesso.ts";

type ClienteCompativel<T extends ClienteContextoAcesso> = T;
/** Confere o contrato do adapter com a biblioteca usada pelo site. */
export type ContratoSupabaseDoPortal = ClienteCompativel<SupabaseClient>;
