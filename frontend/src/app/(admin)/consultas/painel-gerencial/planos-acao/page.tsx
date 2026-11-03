import ProtecaoAbas from "@/components/auth/ProtecaoAbas";
import PainelAcoes from "./PainelAcoes";
export const dynamic="force-dynamic";
export default function Page(){return <ProtecaoAbas modulos={["planos_acao","acoes_corretivas"]}>{abas=><PainelAcoes abas={abas} />}</ProtecaoAbas>;}
