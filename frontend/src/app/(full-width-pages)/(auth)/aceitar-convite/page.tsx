"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
export default function AceitarConvitePage() {
  const router = useRouter();
  const processado = useRef(false);
  const [erro, setErro] = useState("");
  useEffect(() => {
    if (processado.current) return;
    processado.current = true;
    const url = new URL(window.location.href);
    const hash = new URLSearchParams(url.hash.slice(1));
    const tokenHash = url.searchParams.get("token_hash");
    const tipo = tokenHash ? url.searchParams.get("type") : hash.get("type");
    const accessToken = hash.get("access_token"), refreshToken = hash.get("refresh_token");
    window.history.replaceState(null, "", url.pathname);
    const supabase = createClient();
    async function aceitar() {
      try {
        if (tipo !== "invite" || (!tokenHash && (!accessToken || !refreshToken))) throw new Error("link");
        const resultado = tokenHash
          ? await supabase.auth.verifyOtp({ type: "invite", token_hash: tokenHash })
          : await supabase.auth.setSession({ access_token: accessToken!, refresh_token: refreshToken! });
        if (resultado.error || !resultado.data.user) throw new Error("convite");
        const usuario = await supabase.auth.getUser();
        if (usuario.error || !usuario.data.user) throw new Error("sessao");
        router.replace("/atualizar-senha");
      } catch { setErro("Este convite é inválido ou expirou. Solicite ao administrador o reenvio do convite."); }
    }
    void aceitar();
  }, [router]);
  return <div className="w-full"><h1 className="text-2xl font-semibold">Ative seu acesso ao Portal SSO</h1>
    {erro ? <><p role="alert" className="mt-5 rounded-lg bg-red-50 p-4 text-sm text-red-800">{erro}</p>
      <Link href="/signin" className="mt-5 inline-block text-sm font-medium text-brand-600">Voltar para o login</Link></>
      : <p role="status" className="mt-4 text-sm text-gray-500">Validando seu convite...</p>}
  </div>;
}
