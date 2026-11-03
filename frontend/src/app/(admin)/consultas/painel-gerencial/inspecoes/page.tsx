import ProtecaoAbas from "@/components/auth/ProtecaoAbas";
import PainelInspecoes from "./PainelInspecoes";
export const dynamic="force-dynamic";
export default function Page(){return <ProtecaoAbas modulos={["inspecoes"]}>{()=><PainelInspecoes />}</ProtecaoAbas>;}
