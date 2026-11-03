import ProtecaoGestao from "@/components/gestao/ProtecaoGestao";
import GestaoPermissoes from "@/components/gestao/GestaoPermissoes";
export const dynamic = "force-dynamic";
export default function PaginaPermissoes() { return <ProtecaoGestao modulo="permissoes"><GestaoPermissoes /></ProtecaoGestao>; }
