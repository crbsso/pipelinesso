import ProtecaoAbas from "@/components/auth/ProtecaoAbas";
import PainelAvcb from "./PainelAvcb";
export const dynamic="force-dynamic";
export default function Page(){return <ProtecaoAbas modulos={["avcb"]}>{()=><PainelAvcb />}</ProtecaoAbas>;}
