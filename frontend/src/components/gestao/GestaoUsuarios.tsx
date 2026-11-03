"use client";
import { useState } from "react";
import type { Usuario, Pagina, Atribuicao } from "@/lib/gestao/contratos";
import { formatarInstante } from "@/lib/gestao/contratos";
import { salvar } from "@/lib/gestao/cliente";
import EditorConcessao from "./EditorConcessao";
import { Aviso, Cabecalho, Paginacao, botao, campo, painel, secundario, useConsulta } from "./GestaoUI";
function DetalheUsuario({ usuario, podeConceder, atualizar }: { usuario: Usuario; podeConceder: boolean; atualizar: () => void ;}) {
  const concessoes = useConsulta<{ dados: Atribuicao[] ;}>("/api/gestao/usuarios/" + usuario.usuario_id + "/atribuicoes");
  const [editor, setEditor] = useState<Atribuicao | "nova" | null>(null);
  const [erro, setErro] = useState(""), [mensagem, setMensagem] = useState("");
  const [ocupado, setOcupado] = useState(false);
  async function executar(dados: unknown, url: string, method = "POST") {
    setErro(""); setMensagem(""); setOcupado(true);
    try { await salvar(url, dados, method); concessoes.atualizar(); atualizar(); setMensagem("Alteração registrada."); }
    catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível salvar."); }
    finally { setOcupado(false); }
  }
  return <section className={painel + " space-y-4"}>
    <h2 className="text-lg font-semibold">{usuario.email}</h2><Aviso erro={erro || concessoes.erro} mensagem={mensagem} />
    <p className="text-sm">{usuario.ativo ? "Cadastro ativo" : "Cadastro sem acesso ativo"} · {usuario.confirmado ? "E-mail confirmado" : "E-mail pendente de confirmação"}</p>
    <button className={secundario} disabled={ocupado || (!usuario.ativo && !usuario.confirmado)} onClick={() => void executar(
      { id: usuario.usuario_id, ativo: !usuario.ativo, versao: usuario.versao }, "/api/gestao/usuarios")}>
      {usuario.ativo ? "Bloquear acesso ao portal" : "Ativar cadastro no portal"}
    </button>
    <p className="text-sm text-gray-500">Ativar o cadastro permite receber concessões. O acesso às abas é definido pelos perfis vinculados e sua validade.</p>
    <div className="flex items-center justify-between gap-3"><h3 className="font-semibold">Perfis vinculados</h3>
      {podeConceder && <button className={botao} disabled={!usuario.ativo} onClick={() => setEditor("nova")}>Vincular perfil</button>}</div>
    {!podeConceder && <p className="text-sm text-gray-500">Alterar concessões exige gestão de usuários e de permissões.</p>}
    {concessoes.carregando ? <p role="status">Carregando concessões...</p> : !concessoes.dados?.dados.length ? <p className="text-sm text-gray-500">Nenhuma concessão cadastrada.</p> :
      <ul className="space-y-3">{concessoes.dados.dados.map(a => <li key={a.id} className="rounded-lg border border-gray-200 p-4">
        <p className="font-medium">{a.perfil_nome} · {a.ativo ? "Ativa" : "Suspensa"}</p>
        <p className="mt-1 text-xs text-gray-500">Início: {formatarInstante(a.inicio)} · Fim: {formatarInstante(a.fim)} (Brasília)</p>
        {podeConceder && <div className="mt-3 flex gap-2">
          <button className={secundario} disabled={ocupado} onClick={() => setEditor(a)}>Editar</button>
          <button className={secundario} disabled={ocupado} onClick={() => void executar({ id: a.id, ativo: !a.ativo, versao: a.versao }, "/api/gestao/atribuicoes", "PATCH")}>{a.ativo ? "Suspender" : "Reativar"}</button>
        </div>}
      </li>)}</ul>}
    {editor && <EditorConcessao key={editor === "nova" ? "nova" : editor.id} usuario={usuario} inicial={editor === "nova" ? undefined : editor}
      cancelar={() => setEditor(null)} concluir={() => { setEditor(null); concessoes.atualizar(); atualizar(); setMensagem("Perfil vinculado e alteração registrada."); }} />}
  </section>;
}
export default function GestaoUsuarios() {
  const [busca, setBusca] = useState(""), [pagina, setPagina] = useState(1), [id, setId] = useState<string | null>(null);
  const lista = useConsulta<Pagina<Usuario>>("/api/gestao/usuarios?pagina=" + pagina + "&busca=" + encodeURIComponent(busca));
  const contexto = useConsulta<{ usuarios: boolean; permissoes: boolean ;}>("/api/gestao/contexto");
  const usuario = lista.dados?.dados.find(u => u.usuario_id === id);
  return <div className="space-y-6">
    <Cabecalho titulo="Usuários" descricao="Ative cadastros e atribua perfis com acesso às abas do portal. As contas são criadas no serviço de autenticação." atualizar={() => { lista.atualizar(); contexto.atualizar(); }} />
    <Aviso erro={lista.erro || contexto.erro} />
    <label className="block max-w-lg text-sm">Buscar por e-mail<input type="search" className={campo + " mt-1"} value={busca} onChange={e => { setBusca(e.target.value); setPagina(1); setId(null); }} /></label>
    <section className={painel}>
      {lista.carregando ? <p role="status">Carregando usuários...</p> : <div className="overflow-x-auto">
        <table className="w-full text-left text-sm"><caption className="sr-only">Usuários do portal</caption>
          <thead><tr><th className="p-3">E-mail</th><th className="p-3">Cadastro no portal</th><th className="p-3">Ação</th></tr></thead>
          <tbody>{lista.dados?.dados.map(u => <tr key={u.usuario_id} className="border-t border-gray-200">
            <td className="p-3">{u.email}</td><td className="p-3">{u.ativo ? "Ativo" : u.cadastrado ? "Bloqueado" : "Sem cadastro"}</td>
            <td className="p-3"><button className={secundario} onClick={() => setId(u.usuario_id)}>Gerenciar<span className="sr-only"> {u.email}</span></button></td>
          </tr>)}</tbody>
        </table>{lista.dados?.total === 0 && <p className="py-4">Nenhuma conta encontrada.</p>}
      </div>}
      <Paginacao pagina={pagina} total={lista.dados?.total ?? 0} alterar={p => { setPagina(p); setId(null); }} />
    </section>
    {usuario && <DetalheUsuario key={usuario.usuario_id} usuario={usuario} podeConceder={Boolean(contexto.dados?.usuarios && contexto.dados?.permissoes)} atualizar={lista.atualizar} />}
  </div>;
}
