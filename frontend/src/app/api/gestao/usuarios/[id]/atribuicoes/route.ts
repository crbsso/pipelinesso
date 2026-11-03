import { rotaGestao } from "@/lib/gestao/servidor";
import { jsonGestao } from "@/lib/gestao/http";
export const dynamic = "force-dynamic";
export async function GET(request: Request, { params }: { params: Promise<{ id: string ;}> ;}) {
  const { id } = await params;
  if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)) return jsonGestao({ error: "Identificador inválido." }, 400);
  return rotaGestao(request, { modulo: "usuarios", operacao: "listar_atribuicoes", fixos: { usuarioId: id }, semFiltros: true });
}
