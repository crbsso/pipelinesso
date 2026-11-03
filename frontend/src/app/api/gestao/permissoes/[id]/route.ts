import { rotaGestao } from "@/lib/gestao/servidor";
export const dynamic = "force-dynamic";
type Contexto = { params: Promise<{ id: string }> };
export async function GET(request: Request, { params }: Contexto) {
  const { id } = await params;
  return rotaGestao(request, { modulo: "permissoes", operacao: "obter_perfil", fixos: { id }, semFiltros: true });
}
export async function DELETE(request: Request, { params }: Contexto) {
  const { id } = await params;
  return rotaGestao(request, { modulo: "permissoes", operacao: "excluir_perfil", fixos: { id }, escrita: true });
}
