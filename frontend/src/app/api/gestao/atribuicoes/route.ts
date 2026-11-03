import { rotaGestao } from "@/lib/gestao/servidor";
export const dynamic = "force-dynamic";
export function POST(request: Request) { return rotaGestao(request, { modulo: "usuarios", operacao: "salvar_atribuicao", escrita: true, duplaPermissao: true }); }
export function PATCH(request: Request) { return rotaGestao(request, { modulo: "usuarios", operacao: "estado_atribuicao", escrita: true, duplaPermissao: true }); }
