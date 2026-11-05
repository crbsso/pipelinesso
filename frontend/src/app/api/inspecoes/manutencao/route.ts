import { NextResponse } from "next/server";
import { consolidarCargas, type CargaMensalManutencao } from "@/lib/inspecoes/programacao";
import { createClient } from "@supabase/supabase-js";
import { autorizarConsulta, CABECALHOS_ACESSO } from "@/lib/auth/abasServidor";
import { ambienteManutencaoDisponivel, periodoAno, periodoMes, type InspecaoManutencao } from "@/lib/inspecoes/manutencao";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const negacao = await autorizarConsulta("inspecoes");
  if (negacao) return negacao;
  const responder = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: CABECALHOS_ACESSO });
  const url = process.env.SUPABASE_URL;
  // Projetos de homologação e produção previamente validados.
  if (!ambienteManutencaoDisponivel(url)) return responder({ error: "Consulta de manutenção indisponível neste ambiente." }, 404);
  const chave = process.env.SUPABASE_SECRET_KEY;
  if (!chave) return responder({ error: "Consulta temporariamente indisponível." }, 503);
  const parametros = new URL(request.url).searchParams;
  const ano = parametros.get("ano");
  if (ano !== null && parametros.has("mes")) return responder({ error: "Informe somente o ano ou o mês da consulta." }, 400);
  const mes = ano === null ? parametros.get("mes") ?? "2026-10" : null;
  const periodo = ano === null ? periodoMes(mes!) : periodoAno(ano);
  if (!periodo) return responder({ error: ano === null ? "Informe um mês válido no formato AAAA-MM." : "Informe um ano válido entre 1900 e 9998." }, 400);
  try {
    const cliente = createClient(url, chave, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: cargas, error: erroCargas } = await cliente.from("mart_painel_manutencao")
      .select("competencia,extraido_em,publicado_em,conteudo")
      .gte("competencia", periodo.inicio).lt("competencia", periodo.fim)
      .order("competencia").limit(12);
    if (erroCargas || !cargas) throw new Error("Carga mensal indisponível");
    if (cargas.length) {
      const painel = consolidarCargas(cargas as CargaMensalManutencao[]);
      return responder({ total: painel.dados.length, ...(ano === null ? { mes } : { ano }), ...painel });
    }
    const dados: InspecaoManutencao[] = [];
    let esperado: number | null = null;
    do {
      const { data, error, count } = await cliente.from("mart_inspecoes_manutencao")
        .select("id_inspecao,ficha_id,aba_id,ativo_id,data_inspecao,concessao,localizacao,familia,tipo,periodicidade,publicado_em", { count: "exact" })
        .gte("data_inspecao", periodo.inicio).lt("data_inspecao", periodo.fim)
        .order("data_inspecao", { ascending: false }).order("id_inspecao", { ascending: false })
        .order("ficha_id").order("aba_id").range(dados.length, dados.length + 499);
      if (error || count === null || !data) throw new Error("Consulta incompleta");
      if (esperado !== null && esperado !== count) throw new Error("Carga alterada durante a consulta");
      esperado = count;
      if (!data.length && dados.length < esperado) throw new Error("Pagina incompleta");
      dados.push(...data);
    } while (dados.length < esperado);
    return responder({ total: dados.length, ...(ano === null ? { mes } : { ano }), dados });
  } catch {
    return responder({ error: "Não foi possível carregar as inspeções da manutenção. Tente novamente." }, 503);
  }
}
