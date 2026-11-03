import { rotaGestao } from "@/lib/gestao/servidor";
export const dynamic = "force-dynamic";
export function GET(request: Request) { return rotaGestao(request, { modulo: "usuarios", operacao: "catalogo_perfis" }); }
