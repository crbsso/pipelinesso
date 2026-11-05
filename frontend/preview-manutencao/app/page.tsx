import fs from "node:fs/promises";
import path from "node:path";
import PreviewShell from "./shell";
import type { InspecaoManutencao } from "../../src/lib/inspecoes/manutencao";
import { construirMetas, type ProgramacaoManutencao, type AtividadeProgramada } from "../../src/lib/inspecoes/programacao";
export const dynamic = "force-dynamic";
export default async function Page() {
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
