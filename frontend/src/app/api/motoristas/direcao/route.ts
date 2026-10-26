import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "private, no-store" };

function dataValida(valor: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const data = new Date(`${valor}T00:00:00Z`);
  return !Number.isNaN(data.getTime()) &&
    data.toISOString().slice(0, 10) === valor;
}

function proximoDia(valor: string): string {
  const data = new Date(`${valor}T12:00:00Z`);
  data.setUTCDate(data.getUTCDate() + 1);
  return data.toISOString().slice(0, 10);
}

function meiaNoitePaulistaEmUtc(valor: string): string {
  // Historico UTC armazenado como timestamp sem fuso.
  const referencia = new Date(`${valor}T00:00:00Z`);
  const partes = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Sao_Paulo",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(referencia);

  const campo = (tipo: string) =>
    Number(partes.find((p) => p.type === tipo)?.value);

  const horaLocalComoUtc = Date.UTC(
    campo("year"), campo("month") - 1, campo("day"),
    campo("hour"), campo("minute")
  );
  const diferenca = horaLocalComoUtc - referencia.getTime();
  return new Date(
    referencia.getTime() - diferenca
  ).toISOString().slice(0, 19);
}

export async function GET(request: NextRequest) {
  if (
    process.env.NODE_ENV !== "development" &&
    process.env.SSO_MOTORISTAS_APIS_ENABLED !== "true"
  ) {
    return NextResponse.json(
      { error: "Rota em validacao." },
      { status: 404, headers },
    );
  }

  const auth = await createServerClient();
  const {
    data: { user },
    error: authError,
  } = await auth.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: "Nao autorizado." },
      { status: 401, headers },
    );
  }

  const q = request.nextUrl.searchParams;
  const paginaTexto = q.get("pagina") ?? "1";

  if (
    q.getAll("pagina").length > 1 ||
    !/^[1-9]\d{0,3}$/.test(paginaTexto)
  ) {
    return NextResponse.json(
      { error: "Pagina invalida." },
      { status: 400, headers },
    );
  }

  const pagina = Number(paginaTexto);

  if (!Number.isSafeInteger(pagina) || pagina > 1000) {
    return NextResponse.json(
      { error: "Pagina invalida." },
      { status: 400, headers },
    );
  }

  const inicioData = q.get("inicio");
  const fimData = q.get("fim");

  if (
    q.getAll("inicio").length > 1 ||
    q.getAll("fim").length > 1 ||
    (inicioData === null) !== (fimData === null) ||
    (inicioData !== null && fimData !== null &&
      (!dataValida(inicioData) ||
       !dataValida(fimData) ||
       inicioData > fimData))
  ) {
    return NextResponse.json(
      { error: "Intervalo de datas invalido." },
      { status: 400, headers }
    );
  }

  for (const nome of ["coligada", "secao"]) {
    if (
      q.getAll(nome).length > 1 ||
      (q.get(nome)?.length ?? 0) > 150
    ) {
      return NextResponse.json(
        { error: "Filtro invalido." },
        { status: 400, headers },
      );
    }
  }

  const url = process.env.SUPABASE_URL;
  const chave = process.env.SUPABASE_SECRET_KEY;

  if (!url || !chave) {
    return NextResponse.json(
      { error: "Configuracao indisponivel." },
      { status: 503, headers },
    );
  }

  try {
    const supabase = createSupabaseClient(url, chave, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const limite = 100;

    let consulta = supabase
      .from("vw_motoristas_direcao_4h")
      .select(
        "episodio_id,driver_id_cobli,nome_exibicao,placas,coligada,secao_rm,inicio,fim,duracao_min,viagens,status",
        { count: "exact" },
      );

    if (inicioData && fimData) {
      consulta = consulta
        .gte("inicio", meiaNoitePaulistaEmUtc(inicioData))
        .lt("inicio", meiaNoitePaulistaEmUtc(proximoDia(fimData)));
    }

    for (const [chaveFiltro, campo] of [
      ["coligada", "coligada"],
      ["secao", "secao_rm"],
    ] as const) {
      const filtro = q.get(chaveFiltro)?.trim();

      if (filtro && filtro !== "TODOS") {
        consulta = consulta.eq(campo, filtro);
      }
    }

    const inicio = (pagina - 1) * limite;

    const { data, error, count } = await consulta
      .order("inicio", { ascending: false })
      .order("episodio_id", { ascending: true })
      .range(inicio, inicio + limite - 1);

    if (error) {
      throw new Error(error.message);
    }

    const { data: datasCobertura, error: erroCobertura } =
      await supabase
        .from("fato_motoristas_viagens")
        .select("data_evento")
        .order("data_evento", {
          ascending: false,
          nullsFirst: false,
        })
        .limit(1);

    if (erroCobertura) {
      console.warn(
        "Falha ao consultar cobertura historica:",
        erroCobertura.message,
      );
    }

    return NextResponse.json(
      {
        dados: data ?? [],
        paginacao: {
          pagina,
          limite,
          total: count ?? 0,
        },
        aviso:
          "Candidatos sem pausa registrada; direcao efetiva nao comprovada.",
        cobertura_ate: erroCobertura
          ? null
          : (datasCobertura?.[0]?.data_evento ?? null),
      },
      { headers },
    );
  } catch (error) {
    console.error("Erro na consulta de direcao continua:", error);

    return NextResponse.json(
      { error: "Falha ao consultar direcao continua." },
      { status: 500, headers },
    );
  }
}
