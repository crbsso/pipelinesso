import ProtecaoGestao from "@/components/gestao/ProtecaoGestao";
import GestaoSolicitacoes from "@/components/gestao/GestaoSolicitacoes";
export const dynamic="force-dynamic";
export default function PaginaSolicitacoes(){return <ProtecaoGestao modulo="solicitacoes_acesso"><GestaoSolicitacoes/></ProtecaoGestao>;}
