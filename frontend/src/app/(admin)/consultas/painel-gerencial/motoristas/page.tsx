import ProtecaoAbas from "@/components/auth/ProtecaoAbas";
import PainelMotoristas from "./PainelMotoristas";
export const dynamic="force-dynamic";
export default function Page(){return <ProtecaoAbas modulos={["motoristas","motoristas_historico","motoristas_direcao","motoristas_velocidade"]}>{abas=><PainelMotoristas abas={abas} />}</ProtecaoAbas>;}
