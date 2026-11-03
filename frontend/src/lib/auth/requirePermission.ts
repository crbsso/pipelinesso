import { carregarContextoAcesso, type ClienteContextoAcesso, type FalhaContexto } from "./carregarContextoAcesso.ts";
import {
  resolverAbrangencia,
  type AcaoPortal,
  type Abrangencia,
  type ModuloPortal,
  type MotivoNegacao,
} from "./politicaAcesso.ts";

export type ResultadoPermissao =
  | FalhaContexto
  | { readonly ok: false; readonly status: 403 | 404; readonly codigo: MotivoNegacao }
  | { readonly ok: true; readonly usuarioId: string; readonly abrangencia: Abrangencia };

/**
 * Autoriza operacoes no servidor conforme as concessoes atuais.
 * Ao receber ok=true, o chamador DEVE aplicar a abrangencia no banco antes
 * de retornar dados, opcoes de filtros ou agregados. Nao retorna cliente privilegiado.
 * Gates operacionais devem continuar sendo verificados pelo servidor.
 */
export async function requirePermission(
  cliente: ClienteContextoAcesso,
  modulo: ModuloPortal,
  acao: AcaoPortal,
  opcoes: { agora?: Date; recursoHabilitado?: boolean } = {},
): Promise<ResultadoPermissao> {
  const carregamento = await carregarContextoAcesso(cliente);
  if (!carregamento.ok) return carregamento;
  const resultado = resolverAbrangencia(carregamento.contexto, modulo, acao, opcoes);
  if (!resultado.permitido) {
    return {
      ok: false,
      status: resultado.motivo === "RECURSO_INDISPONIVEL" ? 404 : 403,
      codigo: resultado.motivo,
    };
  }
  return {
    ok: true,
    usuarioId: carregamento.contexto.usuarioId,
    abrangencia: resultado.abrangencia,
  };
}
