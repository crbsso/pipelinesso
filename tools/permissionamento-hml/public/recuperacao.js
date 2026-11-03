/** Extrai prova de recuperacao; nunca navega, registra ou transmite a outro site. */
export function extrairTokenRecuperacao(valor, origemHml) {
  let url = new URL(valor);
  for (let i = 0; i < 3 && url.hostname.endsWith(".safelinks.protection.outlook.com"); i++) {
    const original = url.searchParams.get("url");
    if (!original) throw new Error("Link de protecao sem endereco original.");
    url = new URL(original);
  }
  const direta = url.origin === origemHml && url.pathname === "/auth/v1/verify";
  const personalizada = ["https:", "http:"].includes(url.protocol) && url.pathname === "/auth/confirm";
  if (!direta && !personalizada) throw new Error("Formato de link nao reconhecido.");
  if (url.searchParams.get("type") === "magiclink") throw Object.assign(new Error("Link de entrada por e-mail."), { code: "LINK_DE_ENTRADA" });
  if (url.searchParams.get("type") !== "recovery") throw new Error("O link nao e de recuperacao de senha.");
  const token = url.searchParams.get("token_hash") ?? (direta ? url.searchParams.get("token") : null);
  if (!token || !/^[A-Za-z0-9_-]{16,2048}$/.test(token)) throw new Error("Prova de recuperacao ausente ou invalida.");
  return token;
}
