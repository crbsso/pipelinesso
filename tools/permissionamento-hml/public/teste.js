import { revalidarGestao } from "/revalidacao.js";
import { extrairTokenRecuperacao } from "/recuperacao.js";
import { carregarContextoAcesso } from "/regras/carregarContextoAcesso.js";
import { requirePermission } from "/regras/requirePermission.js";
const form = document.querySelector("#login");
const email = document.querySelector("#email");
const senha = document.querySelector("#senha");
const entrar = document.querySelector("#entrar");
const sair = document.querySelector("#sair");
const estado = document.querySelector("#estado");
const lista = document.querySelector("#resultados");
let cliente;
let anonimo;
let config;
let referenciaSessao = null;
function resultado(nome, ok, observacao = "") {
  const item = document.createElement("li");
  item.dataset.ok = String(ok);
  item.textContent = `${ok ? "Aprovado" : "Revisar"} — ${nome}${observacao ? ": " + observacao : ""}`;
  lista.append(item);
  return ok;
}
function status(texto) { estado.textContent = texto; }
async function preparar() {
  config = await (await fetch("/config", { cache: "no-store" })).json();
  if (config.url !== "https://ckfsarzmudwdehiiltwi.supabase.co") throw new Error("Ambiente inesperado");
  const opcoes = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
  cliente = window.supabase.createClient(config.url, config.chavePublica, { ...opcoes, auth: { ...opcoes.auth, storageKey: "sso-hml-validacao" } });
  anonimo = window.supabase.createClient(config.url, config.chavePublica, { ...opcoes, auth: { ...opcoes.auth, storageKey: "sso-hml-anonimo" } });
  if (!["administrador", "sem_acesso"].includes(config.cenario)) throw new Error("Cenário não definido");
  email.value = config.email;
  document.querySelector("#cenario").textContent = config.cenario === "sem_acesso"
    ? "Resultado esperado: login válido; conta ainda sem acesso administrativo ou aos painéis pelo novo modelo."
    : "Resultado esperado: administração de acessos permitida; consulta aos painéis sem concessão.";
  entrar.disabled = false;
  status("Tela pronta. Digite sua senha de homologação para começar.");
}
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!config || email.value.trim().toLowerCase() !== config.email.toLowerCase()) {
    status(config ? "Nesta etapa, use a conta de teste " + config.email + "." : "Aguarde a preparação da tela.");
    return;
  }
  entrar.disabled = true;
  lista.replaceChildren();
  status("Validando o login em homologação…");
  const password = senha.value;
  senha.value = "";
  try {
    const { data, error } = await cliente.auth.signInWithPassword({ email: email.value, password });
    if (error || !data.user) { status("A homologação não aceitou o e-mail e a senha. Use a senha específica deste ambiente ou a opção de recuperação abaixo."); return; }
    form.hidden = true;
    document.querySelector("#abrir-recuperacao").hidden = true;
    document.querySelector("#recuperacao").hidden = true;
    referenciaSessao = { token: data.session?.access_token, usuarioId: data.user.id,
      inicio: config.inicioTeste, fim: config.fimTeste };
    resultado("Sessão preparada para revalidação", Boolean(referenciaSessao.token));
    sair.hidden = false;
    const autenticado = await cliente.auth.getUser();
    resultado("Identidade confirmada pelo serviço de autenticação", !autenticado.error && autenticado.data.user?.id === data.user.id);
    const contexto = await carregarContextoAcesso(cliente);
    const semAcesso = config.cenario === "sem_acesso";
    resultado(semAcesso ? "Conta nova permanece sem cadastro ativo no portal" : "Permissões carregadas para a própria conta",
      semAcesso ? !contexto.ok && contexto.status === 403 && contexto.codigo === "USUARIO_INATIVO"
        : contexto.ok && contexto.contexto.usuarioId === data.user.id);
    for (const [modulo, nome] of [["usuarios", "Administrar usuários"], ["permissoes", "Administrar permissões"], ["solicitacoes_acesso", "Analisar solicitações de acesso"]]) {
      const r = await requirePermission(cliente, modulo, "gerenciar");
      resultado(semAcesso ? nome + ": acesso bloqueado" : nome,
        semAcesso ? !r.ok && r.status === 403 && r.codigo === "USUARIO_INATIVO"
          : r.ok && r.abrangencia.tipo === "corporativa");
    }
    if (!semAcesso && config.inicioTeste && config.fimTeste) {
      const perfilTemporario = contexto.ok ? contexto.contexto.perfis.find(p => p.perfil === "administracao_acessos_hml") : undefined;
      const inicio = new Date(config.inicioTeste);
      const fim = new Date(config.fimTeste);
      resultado("Vigência temporária de 24 horas confirmada",
        Boolean(perfilTemporario) && perfilTemporario.inicio === config.inicioTeste
          && perfilTemporario.fim === config.fimTeste && fim.getTime() - inicio.getTime() === 86400000);
      for (const modulo of ["usuarios", "permissoes", "solicitacoes_acesso"]) {
        const expirado = await requirePermission(cliente, modulo, "gerenciar", { agora: fim });
        resultado("Permissão temporária termina no vencimento: " + modulo,
          !expirado.ok && expirado.status === 403 && expirado.codigo === "SEM_CONCESSAO");
      }
    }
    const leitura = await requirePermission(cliente, "motoristas", "consultar");
    resultado("Consulta a Motoristas permanece sem concessão", !leitura.ok && leitura.status === 403
      && leitura.codigo === (semAcesso ? "USUARIO_INATIVO" : "SEM_CONCESSAO"));
    const semLogin = await anonimo.rpc("obter_contexto_acesso_portal");
    resultado("Consulta das permissões sem login é bloqueada", Boolean(semLogin.error) && [401, 403].includes(semLogin.status));
    const direta = await cliente.from("perfis_portal").select("user_id").limit(1);
    resultado("Leitura direta das identidades é bloqueada", Boolean(direta.error) && [401, 403].includes(direta.status));
    const interna = await cliente.schema("portal_acesso").from("perfis").select("id").limit(1);
    resultado("Estrutura interna permanece fora da API pública", interna.status === 406 && interna.error?.code === "PGRST106");
    const falhas = lista.querySelectorAll('li[data-ok="false"]').length;
    status(falhas ? `Validação concluída com ${falhas} item(ns) para revisão.` : "Validação concluída: todas as verificações passaram.");
    bloqueioSemSair.disabled = Boolean(falhas) || !referenciaSessao?.token;
    reativacaoSemSair.disabled = Boolean(falhas) || !referenciaSessao?.token;
    document.querySelector("#instrucao-sessao").textContent = falhas
      ? "Confira os itens para revisão antes de testar o bloqueio."
      : "Sessão pronta. Aguarde eu informar a suspensão e então clique no botão 1, abaixo.";
    document.querySelector("#testes-sessao").scrollIntoView({ block: "start" });
  } catch {
    status("A validação foi interrompida por falha de conexão. Nenhuma permissão foi alterada por esta tela.");
  } finally { entrar.disabled = false; }
});
sair.addEventListener("click", async () => {
  sair.disabled = true;
  try {
    const { error } = await cliente.auth.signOut({ scope: "local" });
    if (error) { status("Não foi possível encerrar a sessão agora. Feche esta aba para descartar a sessão local."); return; }
    referenciaSessao = null;
    bloqueioSemSair.disabled = true;
    reativacaoSemSair.disabled = true;
    form.hidden = false;
    document.querySelector("#abrir-recuperacao").hidden = false;
    sair.hidden = true;
    senha.value = "";
    status("Sessão de teste encerrada. Os resultados acima ficam disponíveis para revisão nesta aba.");
  } finally { sair.disabled = false; }
});
preparar().catch(() => status("Não foi possível preparar a tela. A configuração deve apontar exclusivamente para homologação."));

const painelRecuperacao = document.querySelector("#recuperacao");
const enviarRecuperacao = document.querySelector("#enviar-recuperacao");
const validarRecuperacao = document.querySelector("#validar-recuperacao");
const novaSenha = document.querySelector("#nova-senha");
document.querySelector("#abrir-recuperacao").addEventListener("click", () => {
  painelRecuperacao.hidden = false;
  status("Use o botão de recuperação para solicitar o e-mail de homologação.");
});
enviarRecuperacao.addEventListener("click", async () => {
  if (!cliente || !config) { status("Aguarde a preparação da tela."); return; }
  enviarRecuperacao.disabled = true;
  try {
    const { error } = await cliente.auth.resetPasswordForEmail(config.email);
    if (error) {
      if (error.code === "over_email_send_rate_limit") {
        status("A homologação atingiu a cota de envio de e-mails. Este pedido não gerou outro e-mail. Aguarde a liberação da cota antes de solicitar novamente.");
      } else {
        status(error.status === 429 ? "Muitas solicitações em sequência. Aguarde antes de tentar novamente." : "O envio não foi concluído. Confira a caixa de e-mail antes de tentar novamente.");
      }
      return;
    }
    validarRecuperacao.hidden = false;
    status("Solicitação enviada. Verifique seu e-mail e copie o endereço do link de recuperação para o campo desta tela, sem compartilhá-lo na conversa.");
  } catch { status("Falha de conexão no envio. Confira o e-mail antes de repetir a solicitação."); }
  finally { enviarRecuperacao.disabled = false; }
});
validarRecuperacao.addEventListener("submit", async (event) => {
  event.preventDefault();
  const campoLink = document.querySelector("#link-recuperacao");
  const link = campoLink.value.trim();
  campoLink.value = "";
  const botao = validarRecuperacao.querySelector("button");
  botao.disabled = true;
  try {
    const token_hash = extrairTokenRecuperacao(link, config.url);
    const { data, error } = await cliente.auth.verifyOtp({ token_hash, type: "recovery" });
    if (error || !data.user) { status("O link não foi aceito. Ele pode ter expirado ou já ter sido usado. Solicite um novo e-mail se necessário."); return; }
    if (data.user.email?.toLowerCase() !== config.email.toLowerCase()) {
      await cliente.auth.signOut({ scope: "local" });
      status("O link pertence a outra conta. Use apenas o e-mail de recuperação da conta de homologação indicada."); return;
    }
    validarRecuperacao.hidden = true;
    enviarRecuperacao.hidden = true;
    form.hidden = true;
    novaSenha.hidden = false;
    status("Recuperação validada. Defina e confirme sua nova senha de homologação.");
  } catch (erro) {
    status(erro?.code === "LINK_DE_ENTRADA"
      ? "Este link serve para entrar por e-mail. Para redefinir a senha, clique em Enviar e-mail de recuperação nesta tela e copie o link do novo e-mail de redefinição."
      : "Não reconheci o link. Copie apenas o endereço do botão de redefinição de senha recebido por e-mail e cole neste campo.");
  }
  finally { botao.disabled = false; }
});
novaSenha.addEventListener("submit", async (event) => {
  event.preventDefault();
  const p1 = document.querySelector("#senha-nova");
  const p2 = document.querySelector("#confirmar-senha");
  if (p1.value !== p2.value || p1.value.length < 12) { status("As senhas devem ser iguais e ter pelo menos 12 caracteres."); return; }
  const password = p1.value;
  p1.value = ""; p2.value = "";
  const botao = novaSenha.querySelector("button");
  botao.disabled = true;
  try {
    const { error } = await cliente.auth.updateUser({ password });
    if (error) { status("A nova senha não foi aceita. Escolha uma senha diferente com letras, números e símbolos. Se persistir, informe apenas a mensagem desta tela."); return; }
    await cliente.auth.signOut({ scope: "local" });
    novaSenha.hidden = true;
    painelRecuperacao.hidden = true;
    enviarRecuperacao.hidden = false;
    referenciaSessao = null;
    bloqueioSemSair.disabled = true;
    reativacaoSemSair.disabled = true;
    document.querySelector("#instrucao-sessao").textContent = "Entre abaixo para habilitar os botões do teste.";
    form.hidden = false;
    document.querySelector("#abrir-recuperacao").hidden = false;
    status("Senha de homologação atualizada. Entre com a nova senha no formulário acima para validar as permissões.");
  } catch { status("Não foi possível confirmar a alteração. Tente entrar com a nova senha antes de solicitar outro link."); }
  finally { botao.disabled = false; }
});

const bloqueioSemSair = document.querySelector("#testar-bloqueio");
const reativacaoSemSair = document.querySelector("#testar-reativacao");
async function executarRevalidacao(ativo) {
  bloqueioSemSair.disabled = true;
  reativacaoSemSair.disabled = true;
  sair.disabled = true;
  lista.replaceChildren();
  status(ativo ? "Verificando a reativação na mesma sessão…" : "Verificando o bloqueio na mesma sessão…");
  try {
    const teste = await revalidarGestao(cliente, referenciaSessao, ativo,
      { carregar: carregarContextoAcesso, permissao: requirePermission });
    for (const v of teste.verificacoes) resultado(v.nome, v.ok);
    status(teste.ok
      ? (ativo ? "Reativação confirmada: todas as verificações passaram, sem novo login."
        : "Bloqueio confirmado: todas as verificações passaram, sem novo login.")
      : "A revalidação encontrou itens para revisão. Informe a mensagem, sem compartilhar credenciais.");
  } finally {
    bloqueioSemSair.disabled = false;
    reativacaoSemSair.disabled = false;
    sair.disabled = false;
  }
}
bloqueioSemSair.addEventListener("click", () => executarRevalidacao(false));
reativacaoSemSair.addEventListener("click", () => executarRevalidacao(true));
