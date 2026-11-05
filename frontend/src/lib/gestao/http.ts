import { requirePermission } from "../auth/requirePermission.ts";
import type { ClienteContextoAcesso } from "../auth/carregarContextoAcesso.ts";
export type ModuloGestao = "usuarios" | "permissoes" | "solicitacoes_acesso";
export type OperacaoGestao = "listar_usuarios" | "salvar_usuario" | "listar_perfis" | "catalogo_perfis"
  | "obter_perfil" | "excluir_perfil" | "salvar_perfil" | "listar_atribuicoes" | "salvar_atribuicao" | "estado_atribuicao"
  | "listar_solicitacoes" | "analisar_solicitacao" | "listar_auditoria"
  | "preparar_aprovacao" | "preparar_convite" | "registrar_convite";
export interface ClienteGestao extends ClienteContextoAcesso {
  rpc(nome: "obter_contexto_acesso_portal"): PromiseLike<{ data: unknown; error: unknown ;}>;
  rpc(nome: "gerir_acessos_portal", dados: { p_operacao: OperacaoGestao; p_dados: Record<string, unknown> ;}):
    PromiseLike<{ data: unknown; error: { code?: string; message?: string ;} | null ;}>;
}
export const cabecalhosPrivados = { "Cache-Control": "private, no-store, max-age=0", Vary: "Cookie" };
export function jsonGestao(dados: unknown, status = 200) {
  return Response.json(dados, { status, headers: cabecalhosPrivados });
}
class FalhaEntrada extends Error {
  status: number;
  constructor(status: number, mensagem: string) { super(mensagem); this.status = status; }
}
async function lerJson(request: Request): Promise<Record<string, unknown>> {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json")
    throw new FalhaEntrada(415, "Envie os dados no formato JSON.");
  const reader = request.body?.getReader();
  if (!reader) throw new FalhaEntrada(400, "Conteúdo da requisição inválido.");
  const partes: Uint8Array[] = []; let tamanho = 0;
  try {
    while (true) {
const r = await reader.read(); if (r.done) break; tamanho += r.value.byteLength;
      if (tamanho > 65536) { await reader.cancel(); throw new FalhaEntrada(413, "O conteúdo excede o limite permitido."); }
      partes.push(r.value);
}
    const bytes = new Uint8Array(tamanho); let pos = 0;
    for (const parte of partes) { bytes.set(parte, pos); pos += parte.byteLength; }
    const v: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error("objeto");
    return v as Record<string, unknown>;
  } catch (e) { if (e instanceof FalhaEntrada) throw e; throw new FalhaEntrada(400, "Conteúdo da requisição inválido."); }
  finally { reader.releaseLock(); }
}
function filtros(request: Request) {
  const params = new URL(request.url).searchParams;
  const d: Record<string, unknown> = {};
  for (const chave of params.keys()) {
    if (!["pagina", "limite", "busca", "status", "empresa"].includes(chave) || params.getAll(chave).length !== 1)
      throw new FalhaEntrada(400, "Filtros inválidos.");
    const valor = params.get(chave)!;
    if (chave === "pagina" || chave === "limite") {
      if (!/^[0-9]{1,6}$/.test(valor)) throw new FalhaEntrada(400, "Paginação inválida.");
      d[chave] = Number(valor);
    } else d[chave] = valor;
  }
  return d;
}
export function falhaBanco(erro: { code?: string; message?: string ;}) {
  if (erro.code === "42501") return jsonGestao({ error: "Você não possui permissão para esta operação." }, 403);
  const custom = erro.code?.match(/^PT(400|403|404|409)$/);
  if (custom) return jsonGestao({ error: erro.message ?? "A operação não foi concluída." }, Number(custom[1]));
  if (["23505", "23503"].includes(erro.code ?? "")) return jsonGestao({ error: "O cadastro já existe ou possui vínculos. Atualize a tela." }, 409);
  if (["22P02", "22007", "22008", "22023", "23514", "23502", "22003"].includes(erro.code ?? ""))
    return jsonGestao({ error: "Revise os campos e as abrangências informadas." }, 400);
  return jsonGestao({ error: "A gestão de acessos está indisponível. Tente novamente mais tarde." }, 503);
}
function origemAlvo(request: Request, origemDoServidor?: string): string {
  const valor = origemDoServidor ?? new URL(request.url).origin;
  try {
    const url = new URL(valor);
    if (!["http:", "https:"].includes(url.protocol) || valor !== url.origin) throw new Error("origem");
    return url.origin;
  } catch {
    throw new FalhaEntrada(503, "A gestão de acessos está indisponível. Tente novamente mais tarde.");
  }
}
export async function executarGestao(request: Request, rota: {
  modulo: ModuloGestao; operacao: OperacaoGestao; escrita?: boolean; duplaPermissao?: boolean;
  fixos?: Record<string, unknown>; semFiltros?: boolean;
  processar?: (cliente: ClienteGestao, dados: Record<string, unknown>) => Promise<Response>;
}, criarCliente: () => Promise<ClienteGestao>, origemDoServidor?: string): Promise<Response> {
  try {
    if (rota.escrita) {
      if (!["POST", "PATCH", "DELETE"].includes(request.method)) return jsonGestao({ error: "Método inválido." }, 405);
      const destino = origemAlvo(request, origemDoServidor);
      const origem = request.headers.get("origin");
      const site = request.headers.get("sec-fetch-site");
      if (!origem || origem !== destino || (site && site !== "same-origin"))
        return jsonGestao({ error: "Origem da requisição inválida." }, 403);
    } else if (request.method !== "GET") return jsonGestao({ error: "Método inválido." }, 405);
    const cliente = await criarCliente();
    for (const modulo of rota.duplaPermissao ? ["usuarios", "permissoes"] as const : [rota.modulo]) {
      const acesso = await requirePermission(cliente, modulo, "gerenciar");
      if (!acesso.ok) return jsonGestao({
error: acesso.status === 401 ? "Entre para continuar." : acesso.status === 503 ?
          "Não foi possível validar suas permissões." : "Você não possui permissão para esta operação."
}, acesso.status);
      if (acesso.abrangencia.tipo !== "corporativa") return jsonGestao({ error: "Permissão de gestão corporativa obrigatória." }, 403);
    }
    const dados = rota.escrita ? await lerJson(request) : rota.semFiltros ? {} : filtros(request);
    for (const [chave, valor] of Object.entries(rota.fixos ?? {})) {
      if (chave in dados && dados[chave] !== valor) throw new FalhaEntrada(400, "O identificador não corresponde ao endereço.");
      dados[chave] = valor;
    }
    if (rota.processar) return await rota.processar(cliente, dados);
    const r = await cliente.rpc("gerir_acessos_portal", { p_operacao: rota.operacao, p_dados: dados });
    return r.error ? falhaBanco(r.error) : jsonGestao(r.data);
  } catch (e) {
    if (e instanceof FalhaEntrada) return jsonGestao({ error: e.message }, e.status);
    return jsonGestao({ error: "Não foi possível concluir a operação neste momento." }, 503);
  }
}
