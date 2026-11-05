import { executarGestao, falhaBanco, jsonGestao, type ClienteGestao } from "./http.ts";
import { requirePermission } from "../auth/requirePermission.ts";
type Resultado = { solicitacao: Record<string, unknown>; conta: { id: string; confirmado: boolean } | null };
export interface AdminConvites {
  resetPasswordForEmail(email: string, opcoes: { redirectTo: string }): PromiseLike<{ error: unknown }>;
  createUser(dados: { email: string; email_confirm: false }): PromiseLike<{ data: { user: { id: string } | null }; error: unknown }>;
  inviteUserByEmail(email: string, opcoes: { redirectTo: string }): PromiseLike<{ data: { user: { id: string } | null }; error: unknown }>;
}
export function analisarSolicitacao(request: Request, id: string, criarCliente: () => Promise<ClienteGestao>,
  criarAdmin: () => AdminConvites, origem?: string) {
  return executarGestao(request, {
    modulo: "solicitacoes_acesso", operacao: "analisar_solicitacao", escrita: true, fixos: { id },
    processar: async (cliente, dados) => {
      if (dados.acao === "REJEITAR") {
        const r = await cliente.rpc("gerir_acessos_portal", { p_operacao: "analisar_solicitacao", p_dados: dados });
        return r.error ? falhaBanco(r.error) : jsonGestao(r.data);
      }
      if (dados.acao !== "APROVAR" && dados.acao !== "REENVIAR_CONVITE")
        return jsonGestao({ error: "Ação inválida." }, 400);
      for (const modulo of ["usuarios", "permissoes"] as const) {
        const r = await requirePermission(cliente, modulo, "gerenciar");
        if (!r.ok || r.abrangencia.tipo !== "corporativa")
          return jsonGestao({ error: "A liberação exige gestão de solicitações, usuários e permissões." }, !r.ok ? r.status : 403);
      }
      const retorno = new URL("/aceitar-convite", origem ?? new URL(request.url).origin).href;
      let admin: AdminConvites | undefined;
      if (dados.acao === "APROVAR") {
        const r = await cliente.rpc("gerir_acessos_portal", { p_operacao: "preparar_aprovacao", p_dados: dados });
        if (r.error) return falhaBanco(r.error);
        const preparado = r.data as Resultado;
        if (typeof preparado?.solicitacao?.email !== "string")
          return jsonGestao({ error: "Não foi possível validar a solicitação." }, 503);
        let usuarioId = preparado.conta?.id;
        if (!usuarioId) {
          admin = criarAdmin();
          const conta = await admin.createUser({ email: preparado.solicitacao.email, email_confirm: false });
          if (conta.error || !conta.data.user)
            return jsonGestao({ error: "Não foi possível preparar a conta. Atualize a solicitação e tente novamente." }, 503);
          usuarioId = conta.data.user.id;
        }
        const aprovado = await cliente.rpc("gerir_acessos_portal", {
          p_operacao: "analisar_solicitacao", p_dados: { ...dados, usuarioId },
        });
        if (aprovado.error) return falhaBanco(aprovado.error);
      } else if (Object.keys(dados).some(k => k !== "id" && k !== "acao")) {
        return jsonGestao({ error: "Dados de reenvio inválidos." }, 400);
      }
      const preparo = await cliente.rpc("gerir_acessos_portal", { p_operacao: "preparar_convite", p_dados: { id } });
      if (preparo.error) return falhaBanco(preparo.error);
      const envio = preparo.data as Resultado;
      const solicitacao = envio?.solicitacao;
      if (typeof solicitacao?.email_corporativo !== "string" || typeof solicitacao.convite_tentativa_id !== "string" || !envio.conta)
        return jsonGestao({ error: "A liberação foi registrada, mas o convite precisa ser conferido. Atualize a tela." }, 503);
      let status: "ENVIADO" | "FALHOU" | "CONTA_EXISTENTE" = "CONTA_EXISTENTE";
      const definirSenha = envio.conta.confirmado && dados.acao === "REENVIAR_CONVITE";
      if (definirSenha) {
        status = "FALHOU";
        try {
          admin ??= criarAdmin();
          const recuperacao = await admin.resetPasswordForEmail(solicitacao.email_corporativo, { redirectTo: retorno });
          if (!recuperacao.error) status = "ENVIADO";
        } catch { /* A falha fica registrada para nova tentativa autorizada. */ }
      } else if (!envio.conta.confirmado) {
        status = "FALHOU";
        try {
          admin ??= criarAdmin();
          const convite = await admin.inviteUserByEmail(solicitacao.email_corporativo, { redirectTo: retorno });
          if (!convite.error && convite.data.user?.id === envio.conta.id) status = "ENVIADO";
        } catch { /* O acesso permanece registrado e o reenvio fica disponível. */ }
      }
      const registro = await cliente.rpc("gerir_acessos_portal", {
        p_operacao: "registrar_convite", p_dados: { id, tentativaId: solicitacao.convite_tentativa_id, status },
      });
      if (registro.error)
        return jsonGestao({ error: "A liberação foi registrada, mas não foi possível registrar o resultado do convite. Atualize a tela antes de reenviar." }, 503);
      return jsonGestao({ ...(registro.data as object), mensagem: status === "ENVIADO"
        ? definirSenha ? "O serviço de e-mail aceitou o envio de um novo link para definir a senha. Use o e-mail mais recente."
          : "Acesso liberado. O serviço de e-mail aceitou o convite para envio; o destinatário poderá definir a senha pelo link."
        : status === "CONTA_EXISTENTE" ? "Acesso liberado. O e-mail desta conta já está confirmado. Se a pessoa precisar definir a senha, use Enviar link para definir senha."
        : "O perfil foi vinculado, mas o serviço de e-mail não confirmou o envio do convite. Confira a configuração de e-mail e use Reenviar convite.",
        conviteEnviado: status === "ENVIADO" });
    },
  }, criarCliente, origem);
}
