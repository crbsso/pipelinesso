"use client";

import dynamic from "next/dynamic";
import type { ApexOptions } from "apexcharts";
import { useTheme } from "@/context/ThemeContext";
import type { PontoManutencao, VisaoManutencao } from "@/lib/inspecoes/manutencao";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

export default function GraficoManutencao({ pontos, visao, ano }: {
  pontos: readonly PontoManutencao[]; visao: VisaoManutencao; ano: string;
}) {
  const { theme } = useTheme();
  const escuro = theme === "dark";
  const acumulado = visao === "anual";
  const options: ApexOptions = {
    chart: { type: acumulado ? "line" : "bar", fontFamily: "inherit", foreColor: escuro ? "#d0d5dd" : "#475467", toolbar: { show: false }, animations: { enabled: false }, background: "transparent" },
    theme: { mode: escuro ? "dark" : "light" },
    colors: [escuro ? "#5eead4" : "#0f766e"],
    grid: { borderColor: escuro ? "#344054" : "#eaecf0", strokeDashArray: 3 },
    plotOptions: { bar: { columnWidth: "45%", borderRadius: 4, borderRadiusApplication: "end" } },
    stroke: { width: acumulado ? 3 : 0, curve: "straight" },
    markers: { size: acumulado ? 5 : 0 },
    dataLabels: { enabled: !acumulado, formatter: (valor: number) => valor === null || valor === undefined ? "" : valor.toLocaleString("pt-BR"), offsetY: -16, style: { fontSize: "12px", colors: [escuro ? "#e4e7ec" : "#344054"] }, background: { enabled: false } },
    xaxis: { categories: pontos.map(ponto => ponto.rotulo), labels: { hideOverlappingLabels: true }, axisBorder: { show: false }, axisTicks: { show: false }, title: { text: ano } },
    yaxis: { min: 0, forceNiceScale: true, title: { text: acumulado ? "Inspeções acumuladas disponíveis" : "Inspeções realizadas" }, labels: { formatter: (valor: number) => Math.round(valor).toLocaleString("pt-BR") } },
    legend: { show: false },
    tooltip: { y: { formatter: (valor: number, contexto?: { dataPointIndex?: number }) => {
      const ponto = pontos[contexto?.dataPointIndex ?? -1];
      if (!ponto || ponto.total === null) return "Sem registros publicados";
      return `${valor.toLocaleString("pt-BR")} inspeções${ponto.mesesComDados < ponto.mesesEsperados ? " · período parcial" : ""}`;
    } } },
    noData: { text: "Sem registros publicados para o ano selecionado" },
    responsive: [{ breakpoint: 640, options: { xaxis: { tickAmount: 4, labels: { rotate: 0 } }, dataLabels: { enabled: false }, yaxis: { title: { text: "Inspeções" } } } }],
  };
  return <figure aria-label={`${acumulado ? "Acumulado dos meses com dados" : "Inspeções realizadas por período"} em ${ano}. Meta em validação. Valores ausentes não equivalem a zero.`}>
    <Chart key={`${visao}-${ano}`} options={options} series={[{ name: acumulado ? "Acumulado disponível" : "Realizadas", data: pontos.map(ponto => ponto.total) }]} type={acumulado ? "line" : "bar"} height={300} />
  </figure>;
}
