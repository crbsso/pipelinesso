"use client";
import { useEffect } from "react";
// Também cobre provedores que retornam o convite para a URL principal do portal.
export default function EncaminharConvite() {
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.pathname === "/aceitar-convite") return;
    const hash = new URLSearchParams(url.hash.slice(1));
    if (["invite", "recovery"].includes(hash.get("type") ?? "") && hash.has("access_token") && hash.has("refresh_token"))
      window.location.replace("/aceitar-convite" + url.hash);
  }, []);
  return null;
}
