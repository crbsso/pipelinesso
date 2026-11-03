import { rotaGestao } from "@/lib/gestao/servidor";
export const dynamic = "force-dynamic";
export function GET(request: Request) { return rotaGestao(request, { modulo: "permissoes", operacao: "listar_perfis" }); }
export function POST(request: Request) { return rotaGestao(request, { modulo: "permissoes", operacao: "salvar_perfil", escrita: true }); }
