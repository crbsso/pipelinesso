import ProtecaoAbas from "@/components/auth/ProtecaoAbas";
import { ambienteManutencaoDisponivel } from "@/lib/inspecoes/manutencao";
import PainelFontesInspecoes from "./PainelFontesInspecoes";
export const dynamic = "force-dynamic";
export default function Page() {
  return <ProtecaoAbas modulos={["inspecoes"]}>{() => <PainelFontesInspecoes manutencaoDisponivel={ambienteManutencaoDisponivel(process.env.SUPABASE_URL)} />}</ProtecaoAbas>;
}
