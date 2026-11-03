/** Diagnostico local: so leitura; nunca retorna tokens ou altera concessoes. */
export async function revalidarGestao(cliente, referencia, esperadoAtivo, helpers) {
  const verificacoes = [];
  const verificar = (nome, ok) => verificacoes.push({ nome, ok: Boolean(ok) });
  const terminar = () => ({ ok: verificacoes.length > 0 && verificacoes.every(v => v.ok), verificacoes });
  try {
    const inicial = await cliente.auth.getSession();
    verificar("A mesma sessão continua aberta", !inicial.error && Boolean(referencia?.token)
      && inicial.data.session?.access_token === referencia.token);
    if (!verificacoes.at(-1).ok) return terminar();
    const identidade = await cliente.auth.getUser();
    verificar("A identidade continua válida", !identidade.error && identidade.data.user?.id === referencia.usuarioId);
    if (!verificacoes.at(-1).ok) return terminar();
    const carregamento = await helpers.carregar(cliente);
    verificar("A conta permanece ativa no portal", carregamento.ok && carregamento.contexto.ativo
      && carregamento.contexto.usuarioId === referencia.usuarioId);
    const perfis = carregamento.ok ? carregamento.contexto.perfis : [];
    const perfil = perfis[0];
    verificar(esperadoAtivo ? "A concessão foi reativada" : "Somente a concessão foi suspensa",
      typeof esperadoAtivo === "boolean" && perfis.length === 1
      && perfil?.perfil === "administracao_acessos_hml" && perfil.ativo === esperadoAtivo);
    verificar("O início e o vencimento originais foram preservados",
      perfil?.inicio === referencia.inicio && perfil?.fim === referencia.fim);
    for (const modulo of ["usuarios", "permissoes", "solicitacoes_acesso"]) {
      const r = await helpers.permissao(cliente, modulo, "gerenciar");
      verificar((esperadoAtivo ? "Gestão permitida: " : "Gestão bloqueada: ") + modulo,
        esperadoAtivo ? r.ok && r.abrangencia.tipo === "corporativa"
          : !r.ok && r.status === 403 && r.codigo === "SEM_CONCESSAO");
    }
    const consulta = await helpers.permissao(cliente, "motoristas", "consultar");
    verificar("A consulta a Motoristas permanece bloqueada",
      !consulta.ok && consulta.status === 403 && consulta.codigo === "SEM_CONCESSAO");
    const final = await cliente.auth.getSession();
    verificar("A verificação terminou sem trocar de sessão",
      !final.error && final.data.session?.access_token === referencia.token);
  } catch {
    verificar("A verificação depende de conexão e identidade válidas", false);
  }
  return terminar();
}
