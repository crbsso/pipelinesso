import fs from "node:fs/promises";
import path from "node:path";
import PreviewShell from "./shell";
import type { InspecaoManutencao } from "../../src/lib/inspecoes/manutencao";
import { consolidarCargas, construirMetas, type ProgramacaoManutencao, type AtividadeProgramada } from "../../src/lib/inspecoes/programacao";
import { validarPosicoesCiclo } from "../../src/lib/inspecoes/ciclosManutencao";
export const dynamic = "force-dynamic";
export default async function Page() {
 if (process.env.SSO_CARGAS_PREVIA_JSON) {
   const cargas = JSON.parse(await fs.readFile(process.env.SSO_CARGAS_PREVIA_JSON, "utf8"));
   const painel = consolidarCargas(cargas);
   const mesInicial = painel.mesesCarregados.map(m => m.mes).sort().at(-1);
   return <PreviewShell dados={painel.dados} posicoes={painel.posicoesCiclo} meses={painel.mesesCarregados} mesInicial={mesInicial} extracao="Prévia local · carga SQL conferida" />;
 }
 if (process.env.SSO_CICLOS_PREVIA_JSON) {
   const fonte = JSON.parse(await fs.readFile(process.env.SSO_CICLOS_PREVIA_JSON, "utf8"));
   if (fonte.versao !== 1 || fonte.origem !== "consultas_sql_conferidas" || !Array.isArray(fonte.posicoes_ciclo)) throw Error("Evidências de ciclos inválidas");
   const meses = [...new Set<string>(fonte.posicoes_ciclo.map((p: { data_corte: string }) => p.data_corte.slice(0,7)))];
   const posicoes = meses.flatMap(mes => validarPosicoesCiclo(fonte.posicoes_ciclo.filter((p: { data_corte: string }) => p.data_corte.startsWith(mes)), `${mes}-01`));
   return <PreviewShell dados={[]} posicoes={posicoes} mesInicial={meses.sort().at(-1)} extracao="Prévia local · consultas conferidas em 16 e 17/11/2026" />;
 }
 const bronze = path.resolve(process.cwd(), "../data/bronze");
 const arquivo = path.join(bronze, "inspecoes_intranet_previa_20261105.json");
 const fonte = JSON.parse(await fs.readFile(arquivo,"utf8"));
 const stat = await fs.stat(arquivo);
 const dados: InspecaoManutencao[] = fonte.registros.map((r: InspecaoManutencao) => ({...r, publicado_em:""}));
 const programacao: ProgramacaoManutencao = JSON.parse(await fs.readFile(path.join(bronze,"metas_os_previa_20261105.json"),"utf8"));
 const atividades: AtividadeProgramada[] = JSON.parse(await fs.readFile(path.join(bronze,"atividades_metas_inspecoes_previa_20261105.json"),"utf8"));
 const extracao = new Intl.DateTimeFormat("pt-BR",{dateStyle:"short",timeStyle:"short",timeZone:"America/Sao_Paulo"}).format(stat.mtime);
 return <PreviewShell dados={dados} extracao={extracao} programacao={programacao} metasPorTipo={construirMetas(programacao,atividades)} />;
}
