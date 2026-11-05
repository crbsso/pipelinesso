import ProtecaoAbas from "@/components/auth/ProtecaoAbas";
import { HML_MANUTENCAO_URL } from "@/lib/inspecoes/manutencao";
import PainelFontesInspecoes from "./PainelFontesInspecoes";
export const dynamic = "force-dynamic";
export default function Page() {
  return <ProtecaoAbas modulos={["inspecoes"]}>{() => <PainelFontesInspecoes manutencaoDisponivel={process.env.SUPABASE_URL === HML_MANUTENCAO_URL} />}</ProtecaoAbas>;
}
