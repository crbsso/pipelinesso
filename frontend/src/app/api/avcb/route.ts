import { autorizarConsulta } from "@/lib/auth/abasServidor";
import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
export const dynamic = "force-dynamic";

export async function GET() {
  const negacao = await autorizarConsulta("avcb");
  if (negacao) return negacao;

  // 2. Credenciais internas do servidor para consultar o mart.
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseSecretKey) {
    return NextResponse.json(
      {
        error: "Configuração do Supabase não encontrada no ambiente.",
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );
  }

  const supabaseAdmin = createSupabaseClient(
    supabaseUrl,
    supabaseSecretKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );

  // 3. Consulta permanece igual à versão que já estava funcionando.
  const { data, error } = await supabaseAdmin
    .from("mart_avcb")
    .select("*")
    .order("projeto", { ascending: true });

  if (error) {
    console.error("Erro ao consultar AVCB:", error);

    return NextResponse.json(
      {
        error: "Não foi possível consultar os AVCBs.",
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );
  }

  return NextResponse.json(
    {
      total: data?.length ?? 0,
      dados: data ?? [],
    },
    {
      headers: {
        "Cache-Control": "private, no-store",
      },
    }
  );
}