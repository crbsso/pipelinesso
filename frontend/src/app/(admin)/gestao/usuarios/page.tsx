import ProtecaoGestao from "@/components/gestao/ProtecaoGestao";
import GestaoUsuarios from "@/components/gestao/GestaoUsuarios";
export const dynamic = "force-dynamic";
export default function PaginaUsuarios() { return <ProtecaoGestao modulo="usuarios"><GestaoUsuarios /></ProtecaoGestao>; }
