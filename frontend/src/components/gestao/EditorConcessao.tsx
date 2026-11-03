"use client";
import { useState } from "react";
import { salvar } from "@/lib/gestao/cliente";
import type { Atribuicao, Perfil, Usuario, Pagina } from "@/lib/gestao/contratos";
import { Aviso, botao, campo, painel, secundario, useConsulta } from "./GestaoUI";
function dataLocal(valor: string | null) {
  if (!valor) return "";
  const data = new Date(valor);
  return new Date(data.getTime() - data.getTimezoneOffset() * 60000).toISOString().slice(0, -1);
}
export default function EditorConcessao({ usuario, inicial, concluir, cancelar }: { usuario: Usuario; inicial?: Atribuicao; concluir: () => void; cancelar: () => void ;}) {
  const [perfil, setPerfil] = useState<Perfil | undefined>(inicial?.perfil);
  const perfilId = perfil?.id ?? "";
  const [busca, setBusca] = useState("");
  const perfis = useConsulta<Pagina<Perfil>>("/api/gestao/catalogo-perfis?limite=100&busca=" + encodeURIComponent(busca));
  const lista = [...(perfis.dados?.dados ?? []), ...(perfil ? [perfil] : [])].filter((p, i, a) => a.findIndex(x => x.id === p.id) === i);
  const [inicio, setInicio] = useState(dataLocal(inicial?.inicio ?? null));
  const [fim, setFim] = useState(dataLocal(inicial?.fim ?? null));
  const [permanente, setPermanente] = useState(Boolean(inicial && inicial.fim === null));
  const [ativo, setAtivo] = useState(inicial?.ativo ?? true);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  async function enviar(event: React.FormEvent) {
    event.preventDefault(); setErro("");
    if (!perfil) { setErro("Selecione um perfil."); return; }
    let ini: string | null, fimUtc: string | null;
    try { ini = inicio ? new Date(inicio).toISOString() : null; fimUtc = permanente ? null : new Date(fim).toISOString(); }
    catch { setErro("Informe um vencimento válido ou selecione sem vencimento."); return; }
    if (ini && fimUtc && ini >= fimUtc) { setErro("O vencimento deve ser posterior ao início."); return; }
    setOcupado(true);
    try {
      await salvar("/api/gestao/atribuicoes", {
...(inicial ? { id: inicial.id, versao: inicial.versao } : {}),
        usuarioId: usuario.usuario_id, perfilId, ativo, inicio: ini, fim: fimUtc, herdarPerfil: true
});
      concluir();
    } catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível salvar."); }
    finally { setOcupado(false); }
  }
  return <form onSubmit={enviar} className={painel + " space-y-5"}>
    <h3 className="text-lg font-semibold">{inicial ? "Editar vínculo" : "Vincular perfil"} · {usuario.email}</h3>
    <Aviso erro={erro || perfis.erro} />
    <label className="block text-sm">Buscar perfil<input className={campo + " mt-1"} value={busca} onChange={e => setBusca(e.target.value)} /></label>
    <fieldset className="space-y-3"><legend className="mb-2 text-sm font-medium">Selecione o perfil</legend>
      {perfis.carregando && <p role="status" className="text-sm">Carregando perfis...</p>}
      {lista.map(p => <label key={p.id} className={"flex cursor-pointer items-start gap-3 rounded-lg border p-4 " + (perfilId === p.id ? "border-brand-500 bg-brand-50 dark:bg-gray-800" : "border-gray-300 dark:border-gray-700")}>
        <input type="radio" name="perfil" required className="mt-1" value={p.id} checked={perfilId === p.id} disabled={ocupado || !p.ativo} onChange={() => setPerfil(p)} />
        <span className="min-w-0 text-sm text-gray-900 dark:text-white"><span className="block font-semibold break-words">{p.nome}{p.ativo ? "" : " (inativo)"}</span>
          <span className="mt-1 block whitespace-pre-wrap break-words text-gray-600 dark:text-gray-300">{p.descricao || "Sem descrição cadastrada."}</span></span>
      </label>)}
      {!perfis.carregando && lista.length === 0 && <p className="text-sm">Nenhum perfil encontrado. Cadastre um perfil em Permissões ou altere a busca.</p>}
    </fieldset>
    <div className="grid gap-4 md:grid-cols-2">
      <label className="text-sm">Início (seu horário local)<input type="datetime-local" step="0.001" className={campo + " mt-1"} value={inicio} onChange={e => setInicio(e.target.value)} /><span className="text-xs text-gray-500">Em branco: imediato.</span></label>
      <label className="text-sm">Vencimento (seu horário local)<input type="datetime-local" step="0.001" required={!permanente} disabled={permanente} className={campo + " mt-1"} value={fim} onChange={e => setFim(e.target.value)} /></label>
    </div>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={permanente} onChange={e => setPermanente(e.target.checked)} />Sem vencimento</label>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={ativo} onChange={e => setAtivo(e.target.checked)} />Vínculo ativo</label>
    <p className="text-sm text-gray-500">Para transferir o usuário, selecione outro perfil e salve o vínculo. As abas permitidas são definidas no perfil. Alterações no perfil valem para todos os usuários vinculados.</p>
    {inicial && !inicial.herdar_perfil && <p role="status" className="text-sm text-amber-800">Ao salvar, este vínculo passará a seguir todas as permissões do perfil selecionado.</p>}
    <div className="flex gap-3"><button className={botao} disabled={ocupado}>{ocupado ? "Salvando..." : "Salvar vínculo"}</button><button type="button" className={secundario} disabled={ocupado} onClick={cancelar}>Cancelar</button></div>
  </form>;
}
