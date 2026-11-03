import {
  validarContextoAutorizacao,
  type ContextoAutorizacao,
} from "./politicaAcesso.ts";

/** Usar somente com o cliente da sessao autenticada, nunca cliente administrativo. */
export interface ClienteContextoAcesso {
  auth: {
    getUser(): Promise<{
      data: { user: { id: string } | null };
      error: unknown;
    }>;
  };
  rpc(nome: "obter_contexto_acesso_portal"): PromiseLike<{ data: unknown; error: unknown }>;
}

export type FalhaContexto = {
  readonly ok: false;
  readonly status: 401 | 403 | 503;
  readonly codigo: "NAO_AUTENTICADO" | "USUARIO_INATIVO" | "AUTORIZACAO_INDISPONIVEL";
};
export type ResultadoContexto =
  | FalhaContexto
  | { readonly ok: true; readonly contexto: ContextoAutorizacao };

/**
 * Sem cache: revogacoes sao consultadas a cada chamada.
 * A RPC nao recebe user_id, papeis ou filtros vindos da requisicao HTTP.
 * Detalhes internos de falhas nunca sao incluidos no resultado.
 */
export async function carregarContextoAcesso(
  cliente: ClienteContextoAcesso,
): Promise<ResultadoContexto> {
  try {
    const autenticacao = await cliente.auth.getUser();
    const usuario = autenticacao.data.user;
    if (autenticacao.error != null || !usuario ||
        typeof usuario.id !== "string" || usuario.id.trim() === "") {
      return { ok: false, status: 401, codigo: "NAO_AUTENTICADO" };
    }

    const { data, error } = await cliente.rpc("obter_contexto_acesso_portal");
    if (error != null || !validarContextoAutorizacao(data) || data.usuarioId !== usuario.id) {
      return { ok: false, status: 503, codigo: "AUTORIZACAO_INDISPONIVEL" };
    }
    if (!data.ativo) return { ok: false, status: 403, codigo: "USUARIO_INATIVO" };
    return { ok: true, contexto: data };
  } catch {
    return { ok: false, status: 503, codigo: "AUTORIZACAO_INDISPONIVEL" };
  }
}
