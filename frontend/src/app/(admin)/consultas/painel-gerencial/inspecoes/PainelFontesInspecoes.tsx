"use client";
import { useState } from "react";
import PainelInspecoes from "./PainelInspecoes";
import PainelManutencao from "./PainelManutencao";

export default function PainelFontesInspecoes({ manutencaoDisponivel }: { manutencaoDisponivel: boolean }) {
  const [fonte, setFonte] = useState("seguranca");
  const [manutencaoVisitada, setManutencaoVisitada] = useState(false);
  return <div className="space-y-6">
    {manutencaoDisponivel && <div role="group" aria-label="Abas de inspeções" className="grid max-w-lg grid-cols-2 gap-2">
      <button type="button" aria-pressed={fonte === "seguranca"} onClick={() => setFonte("seguranca")} className={`h-full rounded-lg px-3 py-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${fonte === "seguranca" ? "bg-blue-600 text-white" : "border border-gray-300 bg-white text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"}`}>Segurança</button>
      <button type="button" aria-pressed={fonte === "manutencao"} onClick={() => { setManutencaoVisitada(true); setFonte("manutencao"); }} className={`h-full rounded-lg px-3 py-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${fonte === "manutencao" ? "bg-blue-600 text-white" : "border border-gray-300 bg-white text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"}`}>Inspeção da Manutenção</button>
    </div>}
    <div hidden={fonte !== "seguranca"}><PainelInspecoes /></div>
    {manutencaoDisponivel && manutencaoVisitada && <div hidden={fonte !== "manutencao"}><PainelManutencao /></div>}
  </div>;
}
