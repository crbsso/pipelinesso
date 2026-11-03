export async function consultar<T>(url: string, options: RequestInit = {}): Promise<T> {
  const r = await fetch(url, { ...options, cache: "no-store" });
  const v = await r.json();
  if (!r.ok) throw new Error(typeof v.error === "string" ? v.error : "Não foi possível concluir a operação.");
  return v as T;
}
export function salvar<T>(url: string, dados: unknown, method = "POST") {
  return consultar<T>(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(dados) });
}
