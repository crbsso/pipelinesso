import { rotaGestao } from "@/lib/gestao/servidor";
export const dynamic = "force-dynamic";
export function GET(request: Request) { return rotaGestao(request, { modulo: "usuarios", operacao: "listar_usuarios" }); }
export function POST(request: Request) { return rotaGestao(request, { modulo: "usuarios", operacao: "salvar_usuario", escrita: true }); }
