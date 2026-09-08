import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseSecretKey) {
    return NextResponse.json(
      {
        error:
          "Configuração do Supabase não encontrada no ambiente.",
      },
      { status: 500 },
    );
  }

  const supabase = createClient(
    supabaseUrl,
    supabaseSecretKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );

  const { data, error } = await supabase
    .from("mart_avcb")
    .select("*")
    .order("projeto", { ascending: true });

  if (error) {
    console.error("Erro ao consultar AVCB:", error);

    return NextResponse.json(
      {
        error: "Não foi possível consultar os AVCBs.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    total: data?.length ?? 0,
    dados: data ?? [],
  });
}