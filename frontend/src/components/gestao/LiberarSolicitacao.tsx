"use client";
import { useState } from "react";
import type { Pagina, Perfil, SolicitacaoAcesso } from "@/lib/gestao/contratos";
import { botao, campo, secundario, useConsulta } from "./GestaoUI";

export default function LiberarSolicitacao({ solicitacao, observacao, concluir, aoProcessar }: {
  solicitacao: SolicitacaoAcesso; observacao: string;
  concluir: (solicitacao: SolicitacaoAcesso) => void; aoProcessar?: (ocupado: boolean) => void;
}) {
  const contexto = useConsulta<{ usuarios: boolean; permissoes: boolean; solicitacoes_acesso: boolean }>("/api/gestao/contexto");
  const pode = Boolean(contexto.dados?.usuarios && contexto.dados?.permissoes && contexto.dados?.solicitacoes_acesso);
  const liberado = Boolean(solicitacao.liberado_em);
  const perfis = useConsulta<Pagina<Perfil>>(pode && !liberado ? "/api/gestao/catalogo-perfis?limite=100" : null);
  const [perfilId, setPerfilId] = useState("");
  const [semVencimento, setSemVencimento] = useState(false);
  const [vencimento, setVencimento] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");
  async function enviar(reenviar = false) {
    setErro(""); setMensagem("");
    let fim: string | null = null;
    if (!reenviar) {
      if (!perfilId) { setErro("Selecione o perfil que será liberado."); return; }
      if (!semVencimento) {
        const data = new Date(vencimento);
        if (!Number.isFinite(data.getTime()) || data.getTime() <= Date.now()) {
          setErro("Informe um vencimento futuro ou selecione Sem vencimento."); return;
        }
        fim = data.toISOString();
      }
    }
    setOcupado(true); aoProcessar?.(true);
    try {
      const resposta = await fetch("/api/gestao/solicitacoes-acesso/" + solicitacao.id, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reenviar ? { acao: "REENVIAR_CONVITE" } : {
          acao: "APROVAR", perfilId, semVencimento, fim, observacao, versao: solicitacao.atualizado_em,
        }),
      });
      const resultado = await resposta.json();
      if (!resposta.ok) throw new Error(resultado.error ?? "Não foi possível concluir a liberação.");
      concluir(resultado.solicitacao);
      setMensagem(resultado.mensagem);
    } catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível concluir a liberação."); }
    finally { setOcupado(false); aoProcessar?.(false); }
  }
  return <section className="mt-6 space-y-4 border-t border-gray-200 pt-5 dark:border-gray-700" aria-label="Liberação do acesso">
    <h3 className="font-semibold">{liberado ? "Acesso liberado" : "Perfil e convite de acesso"}</h3>
    {contexto.carregando ? <p role="status" className="text-sm">Conferindo permissões...</p> : !pode ?
      <p role="alert" className="text-sm text-amber-800">{contexto.erro || "Liberar perfis e convites exige gestão de solicitações, usuários e permissões."}</p> :
      liberado ? <>
        <p className="text-sm">Perfil liberado: <strong>{solicitacao.perfil_liberado_nome}</strong></p>
        <p className="text-sm text-gray-600">{solicitacao.convite_status === "ENVIADO" ? "Convite aceito pelo serviço de e-mail para envio."
          : solicitacao.convite_status === "CONTA_EXISTENTE" ? "A conta já está confirmada. A pessoa pode usar o login existente."
          : solicitacao.convite_status === "FALHOU" ? "O envio do convite falhou. É possível tentar novamente."
          : solicitacao.convite_status === "PROCESSANDO" ? "O envio está sendo processado. Se não concluir, tente novamente após um minuto."
          : "O convite ainda não foi enviado."}</p>
        {solicitacao.convite_status !== "CONTA_EXISTENTE" && <button type="button" className={secundario} disabled={ocupado} onClick={() => void enviar(true)}>
          {ocupado ? "Enviando..." : "Reenviar convite"}</button>}
      </> : <>
        {solicitacao.status === "APROVADO" && <p className="text-sm text-amber-800">A solicitação foi aprovada anteriormente. Conclua a liberação escolhendo o perfil e enviando o convite.</p>}
        <fieldset className="space-y-2" disabled={ocupado}><legend className="mb-2 text-sm font-medium">Qual perfil liberar?</legend>
          {perfis.carregando && <p role="status" className="text-sm">Carregando perfis...</p>}
          {perfis.dados?.dados.filter(p => p.ativo).map(p => <label key={p.id} className={"flex cursor-pointer gap-3 rounded-lg border p-3 " + (perfilId === p.id ? "border-brand-500 bg-brand-50 dark:bg-brand-500/10" : "border-gray-200 dark:border-gray-700")}>
            <input type="radio" name="perfil-liberacao" value={p.id} checked={perfilId === p.id} onChange={() => setPerfilId(p.id)} />
            <span className="text-sm"><strong className="block">{p.nome}</strong><span className="mt-1 block text-gray-500">{p.descricao || "Permissões definidas neste perfil."}</span></span>
          </label>)}
          {!perfis.carregando && !perfis.erro && !perfis.dados?.dados.some(p => p.ativo) && <p className="text-sm">Cadastre um perfil ativo em Permissões antes de liberar o acesso.</p>}
        </fieldset>
        <label className="block text-sm">Vencimento do acesso (seu horário local)
          <input type="datetime-local" className={campo + " mt-1"} disabled={ocupado || semVencimento} value={vencimento} onChange={e => setVencimento(e.target.value)} />
        </label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={ocupado} checked={semVencimento} onChange={e => setSemVencimento(e.target.checked)} />Sem vencimento</label>
        <p className="text-sm text-gray-500">O perfil define as abas disponíveis. Contas confirmadas usam o login existente. Vínculos ativos existentes mantêm sua validade.</p>
        <button type="button" className={botao} disabled={ocupado || perfis.carregando || Boolean(perfis.erro) || !perfilId || (!semVencimento && !vencimento)} onClick={() => void enviar()}>
          {ocupado ? "Liberando acesso..." : solicitacao.status === "APROVADO" ? "Concluir liberação e enviar convite" : "Aprovar e enviar convite"}
        </button>
      </>}
    {(erro || perfis.erro) && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{erro || perfis.erro}</p>}
    {mensagem && <p role="status" className={"rounded-lg p-3 text-sm " + (solicitacao.convite_status === "FALHOU" ? "bg-amber-50 text-amber-900" : "bg-brand-50 text-brand-800")}>{mensagem}</p>}
  </section>;
}
