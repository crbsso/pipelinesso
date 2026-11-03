"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { consultar, salvar } from "@/lib/gestao/cliente";
import { RECURSOS_GESTAO, formatarInstante } from "@/lib/gestao/contratos";
import type { Perfil, Capacidade, Pagina, Auditoria } from "@/lib/gestao/contratos";
import type { ModuloPortal } from "@/lib/auth/politicaAcesso";
import { Aviso, Cabecalho, Paginacao, botao, campo, painel, secundario, useConsulta } from "./GestaoUI";
function EditorPerfil({ inicial, concluir, cancelar }: { inicial?: Perfil; concluir: () => void; cancelar: () => void ;}) {
  const [codigo] = useState(() => inicial?.codigo ?? "perfil_" + crypto.randomUUID().replaceAll("-", ""));
  const [nome, setNome] = useState(inicial?.nome ?? ""), [descricao, setDescricao] = useState(inicial?.descricao ?? "");
  const [ativo, setAtivo] = useState(inicial?.ativo ?? true);
  const [capacidades, setCapacidades] = useState<Capacidade[]>(inicial?.capacidades.filter(c => c.ativo) ?? []);
  const [ocupado, setOcupado] = useState(false), [erro, setErro] = useState("");
  async function enviar(event: React.FormEvent) {
    event.preventDefault(); setErro(""); setOcupado(true);
    try {
await salvar("/api/gestao/permissoes", {
...(inicial ? { id: inicial.id, versao: inicial.versao } : {}),
        codigo, nome, descricao, ativo, capacidades: capacidades.map(({ modulo, acao }) => ({ modulo, acao }))
}); concluir();
}
    catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível salvar."); } finally { setOcupado(false); }
  }
  return <form className={painel + " space-y-4"} onSubmit={enviar}>
    <h2 className="text-lg font-semibold">{inicial ? "Editar perfil" : "Novo perfil"}</h2><Aviso erro={erro} />
    <label className="block text-sm">Nome do perfil<input required maxLength={150} className={campo + " mt-1"} value={nome} onChange={e => setNome(e.target.value)} /></label>
    <label className="block text-sm">Descrição<textarea maxLength={1000} className={campo + " mt-1"} value={descricao} onChange={e => setDescricao(e.target.value)} /></label>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={ativo} onChange={e => setAtivo(e.target.checked)} />Perfil ativo</label>
    <fieldset className="grid gap-3 sm:grid-cols-2"><legend className="mb-3 font-semibold">Abas permitidas</legend>
      <div className="flex gap-2 sm:col-span-2"><button type="button" className={secundario} onClick={() => setCapacidades((Object.entries(RECURSOS_GESTAO) as [ModuloPortal, typeof RECURSOS_GESTAO[ModuloPortal]][]).map(([modulo, r]) => ({ modulo, acao: r.acao })))}>Marcar todas</button><button type="button" className={secundario} onClick={() => setCapacidades([])}>Desmarcar todas</button></div>
      {(Object.entries(RECURSOS_GESTAO) as [ModuloPortal, typeof RECURSOS_GESTAO[ModuloPortal]][]).map(([modulo, r]) =>
        <label key={modulo} className="flex items-center gap-2 rounded-lg border border-gray-200 p-3 text-sm">
          <input type="checkbox" checked={capacidades.some(c => c.modulo === modulo && c.acao === r.acao)}
            onChange={e => setCapacidades(v => e.target.checked ? [...v, { modulo, acao: r.acao }] : v.filter(c => c.modulo !== modulo))} />{r.nome}{r.emPreparacao && <span className="text-xs text-gray-500">Em preparação</span>}
        </label>)}
    </fieldset>
    <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">As abas e permissões são definidas aqui. Todos os usuários vinculados a este perfil recebem suas alterações automaticamente.</p>
    <div className="flex gap-3"><button className={botao} disabled={ocupado}>{ocupado ? "Salvando..." : "Salvar perfil"}</button><button type="button" className={secundario} disabled={ocupado} onClick={cancelar}>Cancelar</button></div>
  </form>;
}
function resumirRegistro(valor: unknown): string[] {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return ["Sem registro anterior."];
  const r = valor as Record<string, unknown>, linhas: string[] = [];
  for (const [chave, rotulo] of [["nome", "Nome"], ["descricao", "Descrição"], ["status", "Situação"]] as const)
    if (typeof r[chave] === "string" && r[chave]) linhas.push(rotulo + ": " + r[chave]);
  if (typeof r.ativo === "boolean") linhas.push("Estado: " + (r.ativo ? "ativo" : "inativo"));
  if (typeof r.papel === "string") linhas.push("Cadastro: " + (r.papel === "ADMIN_SSO" ? "administrador anterior" : "usuário"));
  if (typeof r.modulo === "string" && r.modulo in RECURSOS_GESTAO) linhas.push("Área: " + RECURSOS_GESTAO[r.modulo as ModuloPortal].nome);
  if (typeof r.acao === "string") linhas.push("Capacidade: " + (r.acao === "gerenciar" ? "gestão" : "consulta"));
  if (r.tipo === "corporativa" || r.tipo === "restrita") linhas.push("Abrangência: " + (r.tipo === "corporativa" ? "toda a empresa" : "unidades informadas"));
  const rotulos = Object.assign({}, ...Object.values(RECURSOS_GESTAO).map(v => v.campos)) as Record<string, string>;
  if (Array.isArray(r.unidades)) for (const u of r.unidades) {
    if (u && typeof u === "object") linhas.push("Unidade: " + Object.entries(u).map(([k, v]) => (rotulos[k] ?? k) + ": " + String(v)).join(" · "));
  }
  for (const [chave, rotulo] of [["inicio", "Início"], ["fim", "Vencimento"]] as const)
    if (chave in r && (r[chave] === null || typeof r[chave] === "string")) linhas.push(rotulo + ": " + formatarInstante(r[chave] as string | null));
  return linhas.length ? linhas : ["Alteração de configuração registrada."];
}
function RegistroAuditoria({ titulo, valor }: { titulo: string; valor: unknown ;}) {
  return <div><p className="font-medium">{titulo}</p><ul className="mt-1 space-y-1 rounded-lg bg-gray-50 p-3 text-xs dark:bg-gray-800">
    {resumirRegistro(valor).map((linha, i) => <li key={i}>{linha}</li>)}</ul></div>;
}
const nomes: Record<string, string> = {
"public.perfis_portal": "Cadastro de usuário", "portal_acesso.perfis": "Perfil",
  "portal_acesso.permissoes_perfil": "Capacidade do perfil", "portal_acesso.atribuicoes": "Concessão",
  "portal_acesso.abrangencias": "Abrangência", "public.solicitacoes_acesso": "Análise de solicitação"
};
function ExcluirPerfil({ perfil, concluir, cancelar }: { perfil: Perfil; concluir: () => void; cancelar: () => void }) {
  const [ocupado, setOcupado] = useState(false), [erro, setErro] = useState("");
  const vinculado = perfil.usuarios_vinculados > 0;
  async function excluir() {
    setOcupado(true); setErro("");
    try {
      await salvar("/api/gestao/permissoes/" + perfil.id, { versao: perfil.versao }, "DELETE");
      concluir();
    } catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível excluir o perfil."); }
    finally { setOcupado(false); }
  }
  return <section className={painel + " space-y-4"} aria-labelledby="excluir-perfil-titulo">
    <h2 id="excluir-perfil-titulo" className="text-lg font-semibold">Excluir perfil · {perfil.nome}</h2>
    <Aviso erro={erro || (vinculado ? "Este perfil possui " + perfil.usuarios_vinculados + " usuário(s) vinculado(s). Atribua outro perfil a esses usuários antes de excluí-lo, inclusive nos vínculos suspensos ou vencidos." : "")} />
    {vinculado ? <Link className={secundario + " inline-block"} href="/gestao/usuarios">Gerenciar usuários</Link> :
      <p className="text-sm">Confirma a exclusão deste perfil sem usuários? O histórico de alterações será preservado.</p>}
    <div className="flex gap-3">
      {!vinculado && <button className={botao} disabled={ocupado} onClick={() => void excluir()}>{ocupado ? "Excluindo..." : "Confirmar exclusão"}</button>}
      <button className={secundario} disabled={ocupado} onClick={cancelar}>Cancelar</button>
    </div>
  </section>;
}
export default function GestaoPermissoes() {
  const [pagina, setPagina] = useState(1), [paginaAudit, setPaginaAudit] = useState(1), [busca, setBusca] = useState("");
  const [editor, setEditor] = useState<Perfil | "novo" | null>(null), [excluir, setExcluir] = useState(false);
  const [mensagem, setMensagem] = useState(""), [erro, setErro] = useState(""), [carregandoPerfil, setCarregandoPerfil] = useState(false);
  const areaEditor = useRef<HTMLDivElement>(null);
  const lista = useConsulta<Pagina<Perfil>>("/api/gestao/permissoes?pagina=" + pagina + "&busca=" + encodeURIComponent(busca));
  const auditoria = useConsulta<Pagina<Auditoria>>("/api/gestao/auditoria?pagina=" + paginaAudit);
  useEffect(() => { if (editor) areaEditor.current?.focus(); }, [editor, excluir]);
  function abrir(perfil: Perfil | "novo", remover = false) {
    setEditor(perfil); setExcluir(remover); setErro(""); setMensagem("");
  }
  function concluir(texto: string) {
    setEditor(null); lista.atualizar(); auditoria.atualizar(); setMensagem(texto);
  }
  async function abrirHistorico(id: string) {
    setCarregandoPerfil(true); setErro("");
    try { const r = await consultar<{ perfil: Perfil }>("/api/gestao/permissoes/" + id); abrir(r.perfil); }
    catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível carregar o perfil."); }
    finally { setCarregandoPerfil(false); }
  }
  return <div className="space-y-6">
    <Cabecalho titulo="Permissões" descricao="Crie perfis, marque as abas permitidas e atribua o mesmo perfil aos usuários que precisarem desses acessos." atualizar={() => { lista.atualizar(); auditoria.atualizar(); }} />
    <Aviso erro={erro || lista.erro || auditoria.erro} mensagem={mensagem} />
    <div className="flex flex-wrap items-end justify-between gap-3"><label className="block max-w-lg flex-1 text-sm">Buscar perfil<input type="search" className={campo + " mt-1"} value={busca} onChange={e => { setBusca(e.target.value); setPagina(1); }} /></label>
      <button className={botao} onClick={() => abrir("novo")}>Novo perfil</button></div>
    <section className={painel}>
      {lista.carregando ? <p role="status">Carregando perfis...</p> : <ul className="divide-y divide-gray-200">
        {lista.dados?.dados.map(p => <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
          <div><h2 className="font-semibold">{p.nome} · {p.ativo ? "Ativo" : "Inativo"}</h2><p className="mt-1 text-sm text-gray-500">{p.descricao}</p>
            <p className="mt-1 text-xs">{p.capacidades.filter(c => c.ativo).map(c => RECURSOS_GESTAO[c.modulo].nome).join(" · ") || "Sem capacidades ativas"}</p>
            <p className="mt-1 text-xs text-gray-500">{p.usuarios_vinculados} usuário(s) vinculado(s)</p></div>
          <div className="flex gap-2">
            <button className={secundario} onClick={() => abrir(p)}>Editar<span className="sr-only"> {p.nome}</span></button>
            <button className={secundario} onClick={() => abrir(p, true)}>Excluir<span className="sr-only"> {p.nome}</span></button>
          </div>
        </li>)}</ul>}
      {lista.dados?.total === 0 && <p>Nenhum perfil encontrado.</p>}
      <Paginacao pagina={pagina} total={lista.dados?.total ?? 0} alterar={setPagina} />
    </section>
    <div ref={areaEditor} tabIndex={-1}>
      {editor && (excluir && editor !== "novo" ?
        <ExcluirPerfil key={editor.id} perfil={editor} cancelar={() => setEditor(null)} concluir={() => concluir("Perfil excluído. Histórico preservado.")} /> :
        <EditorPerfil key={editor === "novo" ? "novo" : editor.id} inicial={editor === "novo" ? undefined : editor} cancelar={() => setEditor(null)}
          concluir={() => concluir("Perfil salvo e auditado.")} />)}
    </div>
    <details className={painel}>
      <summary className="cursor-pointer text-lg font-semibold">Histórico de alterações</summary>
      <p className="mt-2 text-sm text-gray-500">O histórico é preservado. Use Editar perfil atual para alterar o cadastro existente.</p>
      {auditoria.carregando ? <p role="status" className="mt-4">Carregando histórico...</p> : <ul className="mt-4 divide-y divide-gray-200">
        {auditoria.dados?.dados.map(a => <li key={a.id} className="py-3 text-sm">
          <p className="font-medium">{nomes[a.entidade] ?? "Configuração de acesso"} · {a.operacao === "INSERT" ? "Inclusão" : a.operacao === "DELETE" ? "Remoção" : "Alteração"}</p>
          <p className="text-gray-500">{a.autor} · {formatarInstante(a.ocorrido_em)} (Brasília){a.alvo ? " · Conta: " + a.alvo : ""}</p>
          {a.perfil_atual_id && <button className={secundario + " mt-2"} disabled={carregandoPerfil} onClick={() => void abrirHistorico(a.perfil_atual_id!)}>Editar perfil atual</button>}
          <details className="mt-2"><summary className="cursor-pointer">Ver registro da alteração</summary>
            <div className="mt-2 grid gap-3 md:grid-cols-2"><RegistroAuditoria titulo="Antes" valor={a.antes} /><RegistroAuditoria titulo="Depois" valor={a.depois} /></div>
          </details>
        </li>)}</ul>}
      <Paginacao pagina={paginaAudit} total={auditoria.dados?.total ?? 0} alterar={setPaginaAudit} />
    </details>
  </div>;
}
