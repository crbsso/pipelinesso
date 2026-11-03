# Homologacao da gestao de acessos — 30/10/2026

> Atualização de 03/11/2026: a entrega foi delimitada ao acesso por abas, conforme decisão do usuário na conversa anterior. Integração e validação real registradas em [FECHAMENTO_PERMISSOES_ABAS_20261103.md](FECHAMENTO_PERMISSOES_ABAS_20261103.md). As pendências anteriores de matriz por unidade não integram esta versão.

Cenarios administrativos autorizados validados em HML: consulta das tres telas, ciclo de perfil, revogacao na sessao, concorrencia SQL/interface, concessao temporaria redundante (criar/editar/suspender/reativar) e aprovacao/rejeicao de solicitacoes ficticias pela interface. A matriz real e o isolamento dos paineis continuam pendentes; nao se declara permissionamento completo.

## Versao e ambiente

- Worktree: pipelinesso-permissoes; branch feat/portal-sso-permissoes-20261029.
- Candidato inicial: 81b5a013d3b9828273d18e7871e3a05c8eb41155.
- Candidato do build HML atual: 2971511ec69eeb5ed5ee85e5a118e43f5f9572da, apos correcao da origem.
- Supabase HML: ckfsarzmudwdehiiltwi, pipelinesso-homologacao, PostgreSQL 17.11.
- Aplicada somente integrar_gestao_acessos_portal. Versao remota: 20261030103220.
- O arquivo local foi renomeado para acompanhar a versao remota, sem mudar o SQL.
- Portal local: http://127.0.0.1:3001. Build Next.js 16.4.1/webpack com apenas URL e chave publica HML. Nenhuma chave administrativa foi configurada nesse servidor.
- Sem push, PR, merge ou alteracao de producao.

## Resultados confirmados

Na validacao inicial, 75 testes locais passaram; a correcao posterior da origem elevou a suite aprovada a 78. O lint dos arquivos da integracao passou; o build HML terminou com TypeScript e as tres paginas dinamicas. Permanece o aviso sobre os dois lockfiles existentes.

No PostgreSQL 17, leituras com role authenticated e identidade simulada da conta de teste retornaram dois usuarios, um perfil, uma concessao do administrador permanente, zero solicitacoes e 18 auditorias. Os testes transacionais validaram privilegios, quatro caminhos de tentativa de remover o ultimo administrador permanente, rollback da auditoria, rejeicao de versao antiga e de ator externo, autoria, escopo nativo invalido, aprovacao sem criar Auth/concessao e expiracao. Outro teste confirmou independencia das tres capacidades de gestao. Todos foram descartados com ROLLBACK; nao equivalem a login HTTP real.

A comparacao preservou definicoes/grants/RLS das 34 relacoes operacionais e definicoes/grants das nove rotinas publicas operacionais. As 18 auditorias foram preservadas; o administrador permanente continua elegivel. Nao foram criadas contas ou concessoes permanentes para os testes.

A verificacao de seguranca nao acrescentou avisos: 38 informativos RLS sem policies, um aviso preexistente de search_path mutavel e um de protecao contra senhas vazadas desativada. O informativo adicional em relacao ao dia anterior pertence a outra migration, ja estava no inventario imediatamente anterior desta etapa. Remediacoes oficiais estao na evidencia JSON.

HTTP local sem sessao: login 200, tres paginas protegidas redirecionando 307 para signin, tres APIs retornando 401 com private/no-store; POST com origem cruzada retornou 403.

## Pendencias e limites

1. Proxima etapa: definir a matriz concreta de acessos e integrar um modulo piloto, com isolamento de detalhes, totais, filtros e rankings. Os cenarios administrativos desta rodada foram validados; observar seu alcance documentado.
2. Alcance da concorrencia: a disputa SQL/interface em perfil vazio foi comprovada por duas sessoes PostgreSQL reais, espera na trava e rejeicao da versao antiga. Isso nao exercita todos os pares de operacoes nem disputa entre dois administradores permanentes. Nao criar outro administrador automaticamente.
3. A conta seguranca@celeogroup.com continua temporaria, com vencimento exclusivo em 30/10/2026 15h43m20,625s de Brasilia (18:43:20.625Z). Nao foi prorrogada.
4. O login existente redireciona inicialmente para o painel AVCB. Os testes desta etapa sao as rotas /gestao/usuarios, /gestao/permissoes e /gestao/solicitacoes-acesso. Consultas aos paineis ainda nao foram integradas ao novo modelo; este servidor nao recebeu credencial privilegiada para consultas legadas.
5. Permanecem 15 registros de auditoria npm (nove altos, dois moderados, quatro baixos). Esta etapa nao libera producao.
6. As consultas iniciais foram verificadas pelo usuario. Posteriormente o agente abriu uma nova aba IAB, reutilizou a sessao existente e executou a tentativa concorrente pela interface, sem ler credenciais. Captura do aviso preservada.

Evidencias: evidencias/HOMOLOGACAO_GESTAO_20261030.json.
Consultas repetiveis com ROLLBACK: supabase/reviews/permissionamento/validar_gestao_hml_20261030.sql.

## Confirmacao de consulta com login real — 30/10/2026

O erro inicialmente informado era no painel AVCB, destino automatico do login. A consulta legada depende de configuracao de servidor ausente neste ambiente local de teste. Nao foi corrigida nem ampliado o escopo para dados operacionais.

As capturas enviadas pelo usuario mostram /gestao/usuarios com as duas contas e /gestao/permissoes com o perfil e o historico carregados. Outra captura era do formulario publico /solicitar-acesso e nao da lista administrativa. Depois de orientado a abrir /gestao/solicitacoes-acesso, o usuario confirmou: "Nao achei erros". Assim, o carregamento das tres telas administrativas com login real esta confirmado pelo usuario. Nao houve captura de credenciais nem alegacao de teste automatizado de navegador.

## Correcao da origem no primeiro teste de gravacao — 30/10/2026

O usuario tentou criar o perfil de teste vazio e recebeu "Origem da requisicao invalida". A reproducao HTTP sem credenciais mostrou que Origin http://127.0.0.1:3001 recebia 403, enquanto http://localhost:3001 chegava a autenticacao (401). Isso identifica divergencia entre a origem do navegador e a URL interna entregue pelo Next.js. O banco permaneceu com um perfil, 18 auditorias e zero perfis de teste (consulta 12:17:46Z).

Correcao: a rota de gestao passa PORTAL_SSO_ORIGIN, configuracao exclusiva do servidor, ao validador. Ela deve conter exatamente protocolo, dominio e porta, sem caminho/barra final. No teste local foi definido http://127.0.0.1:3001. Ausencia de configuracao preserva a comparacao estrita com request.url; configuracao presente invalida falha fechada com 503. Host e X-Forwarded-Host nao escolhem a origem confiavel. Permanecem obrigatorios Origin correspondente, Sec-Fetch-Site same-origin quando presente, JSON, sessao validada e capacidades no servidor/banco.

78 testes passaram, incluindo tres casos novos que falharam antes da correcao: URL interna diferente, recusa de aliases/portas/protocolos/cabecalhos forjados e configuracao invalida. Rebuild/reteste HTTP e nova tentativa pelo usuario serao registrados apos execucao; nao considerar o perfil criado antes de confirmar persistencia e auditoria. Nenhuma migration nova ou mudanca de permissoes remotas.

Referencia primaria: https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html#identifying-the-target-origin

Rebuild HML e TypeScript passaram no candidato 2971511ec69eeb5ed5ee85e5a118e43f5f9572da. O portal reiniciou na porta 3001 com PORTAL_SSO_ORIGIN explicito. Nove verificacoes HTTP sem sessao passaram: origem local correta chega a autenticacao (401); alias localhost, outra porta, outro protocolo, origem externa, cross-site, ausencia de origem, origem null e forwarded forjado recebem 403. Esses checks nao gravam dados. Evidencia: evidencias/CORRECAO_ORIGEM_GESTAO_20261030.json. Solicitada ao usuario nova tentativa de Salvar perfil na interface autenticada; criacao/edicao/desativacao e autoria continuam pendentes dessa confirmacao.

## Criacao confirmada pela interface autenticada — 30/10/2026

Apos a correcao, o usuario confirmou "Perfil salvo e auditado". A consulta somente de leitura confirmou o perfil Homologacao_teste_31.10.26 (id e6706ce6-a7fa-4f23-a51b-cdd3d3ccafdb), ativo, descricao Teste, zero capacidades e zero atribuicoes. Foi criado em 30/10/2026 12:26:17Z, independentemente da data escrita pelo usuario no nome. Auditoria INSERT 85a30de1-cab3-4f24-ad18-318f8ed935c1, autoria verificada de seguranca@celeogroup.com (auth.uid 6b08a067-e510-4356-85a0-91982b0d9353); total passou de 18 para 19. O perfil original conserva tres capacidades e duas atribuicoes. Criacao com login real validada; edicao e desativacao ainda pendentes. Evidencia: evidencias/GRAVACOES_GESTAO_20261030.json.

## Ciclo do perfil vazio concluido — 30/10/2026

O usuario concluiu a edicao e a desativacao. A consulta de 12:31:56Z confirmou descricao Teste de edicao validado, ativo=false, zero capacidades e zero atribuicoes no perfil de teste. O historico registra INSERT seguido de dois UPDATEs, todos atribuídos a seguranca@celeogroup.com. A edicao de descricao ocorreu as 12:30:57Z e preservou ativo=true; a desativacao ocorreu as 12:31:38Z e preservou a descricao editada. Valores anteriores/posteriores conferidos. Total de auditorias: 21 (18 iniciais + tres operacoes deste ciclo).

O administrador permanente continua elegivel. O perfil administrativo original continua ativo com tres capacidades e duas atribuicoes. O perfil de teste permanece inativo, sem conceder acesso, e seu historico foi preservado. Ciclo de criacao/edicao/desativacao do perfil vazio aprovado com login real; nao declarar todos os fluxos ou concorrencia homologados. Evidencia completa: evidencias/GRAVACOES_GESTAO_20261030.json.

## Primeira tentativa de disputa SQL/interface — 30/10/2026

Aprovado pelo usuario testar duas edicoes simultaneas no perfil de teste inativo. O formulario foi preparado pelo usuario, sem salvar. A manutencao SQL foi limitada ao UUID do perfil vazio e a sua versao esperada, sem assumir identidade Auth; aguardaria ate 30 segundos por uma RPC gerir_acessos_portal comprovadamente bloqueada pela sua trava. A janela terminou sem observar tal RPC e a manutencao foi revertida automaticamente. Consulta posterior em 12:40:12Z confirmou descricao e versao anteriores, 21 auditorias, zero capacidades, zero atribuicoes e administrador permanente preservado. O teste e inconclusivo; nao comprova disputa simultanea nem falha da protecao. Perguntado ao usuario se chegou a salvar e qual mensagem apareceu. Evidencia: evidencias/CONCORRENCIA_GESTAO_20261030.json. Roteiro: supabase/reviews/permissionamento/concorrencia_interface_hml_20261030.sql.

## Concorrencia real confirmada pelo agente — 30/10/2026

A limitacao anterior era do controle de janela nativa. Uma nova aba IAB abriu o portal local ja autenticado e permitiu controle seguro pelo navegador. O agente preparou a descricao Tentativa da tela — concorrencia, mantendo o perfil de teste inativo e vazio.

A manutencao SQL iniciou as 12:49:52Z, alterou exclusivamente a descricao para Teste de concorrencia — versao preservada e manteve a trava transacional. As 12:49:57Z, pg_locks e pg_stat_activity comprovaram a RPC PostgREST 14.18, PID 953291, ativa e aguardando Lock/advisory, bloqueada pelo PID 953288 da manutencao. A manutencao foi confirmada somente apos observar a disputa. A interface exibiu O perfil mudou. Atualize a tela antes de salvar.

Consulta final em 12:51:20Z confirmou a versao e3d753147fc34b30fdcfa2dc537356f8 e a descricao da manutencao preservadas; zero capacidades, zero atribuicoes, ativo=false e administrador permanente elegivel. O total passou de 21 para 22 auditorias: apenas o UPDATE de manutencao a68dc416-97e9-4363-923e-42bb15909165. Ele registra autor_id null, sessao postgres, sem atribuir falsamente a manutencao ao usuario autenticado. A tentativa antiga nao persistiu nem gerou evento de alteracao. O formulario antigo foi cancelado, e a listagem foi atualizada.

Caso de serializacao e conflito de versao aprovado. Nao comprova todos os cenarios concorrentes; os fluxos de concessao/analise pela interface continuam pendentes. Nenhum codigo de aplicacao, objeto de banco, credencial, concessao ou producao foi alterado nesta verificacao.

Evidencias: evidencias/CONCORRENCIA_GESTAO_20261030.json e evidencias/imagens/CONCORRENCIA_GESTAO_20261030.jpg.

## Rodada administrativa pela interface concluida — 30/10/2026

Autorizacao: concluir concessoes, suspensao/reativacao e analise de solicitacoes em HML. Baseline: duas contas Auth, duas atribuicoes, zero solicitacoes e 22 auditorias. Foi reutilizada a sessao IAB de seguranca@celeogroup.com, sem coletar credenciais.

O perfil de teste recebeu temporariamente apenas solicitacoes_acesso.gerenciar, capacidade que a conta ja possuia. A interface criou a atribuicao e3b15468-6d22-4f4e-a682-4f597a523d50 ate 17:00Z (14h de Brasilia), depois editou inicio para 14:00Z (11h) e fim para 16:45Z (13h45). O vencimento administrativo original de 18:43:20.625Z foi preservado. Abrangencia corporativa, conforme a capacidade de gestao; nao testa restricoes de consulta por unidade.

O preenchimento automatizado de datetime-local nao sincronizou inicialmente o valor com o formulario. A validacao bloqueou a gravacao sem data valida. O teclado nativo resolveu o preenchimento, com datas conferidas no banco; nao foi alterado codigo nem criada concessao sem vencimento.

Historico de estados da atribuicao: true (criacao), true (edicao), false, true, false, true, false. Houve duas reativacoes; o estado final foi confirmado suspenso. Perfil final inativo e zero capacidades ativas. A atribuicao suspensa e sua abrangencia permanecem cadastradas para preservar o historico; nao declarar ausencia de vinculos. A capacidade de perfil permanece como linha inativa.

Foram preparadas por INSERT SQL duas solicitacoes ficticias com emails example.invalid. Pela interface, 7612bda0-d61c-4f92-95ab-61c0c32c7b3c foi APROVADO e 72f63d8e-6d12-4198-9e69-26d37428bda5 foi REJEITADO, com observacoes e analisado_por corretos. Registros processados nao ofereceram botoes Aprovar/Rejeitar. Filtros APROVADO, REJEITADO, PENDENTE, empresa e busca conferidos; estado final: zero pendentes, uma aprovada, uma rejeitada, total dois. O formulario publico de envio nao foi exercitado nesta rodada.

Consulta final 14:54:35Z (11h54 de Brasilia): duas contas Auth, zero contas dos emails ficticios, tres atribuicoes (duas originais intactas e a adicional suspensa), administrador permanente preservado. Analises nao criaram contas nem concessoes. Total de auditorias 38, com os 16 novos eventos atribuidos a seguranca@celeogroup.com, papel authenticated e sessao authenticator. Auditoria das analises contem somente id/status/analisado_por, sem copiar justificativas.

Cenarios desta rodada aprovados. A suspensao da concessao redundante nao bloqueia a conta, pois a original foi preservada; negacao efetiva na mesma sessao foi validada separadamente na etapa anterior. Nao declara todas as operacoes ou todos os casos concorrentes homologados. Nenhum codigo, dependencia, migration, Auth ou credencial alterados. A suite de 78 testes permanece a ultima validacao; nao foi repetida para dados/documentacao.

Evidencia resumida com IDs para consulta da auditoria completa: evidencias/FLUXOS_ADMINISTRATIVOS_GESTAO_20261030.json. Quatro capturas FLUXOS_* em evidencias/imagens. Roteiros de preparacao e conferencia em supabase/reviews/permissionamento. Proximo passo: matriz real e proposta do piloto AVCB.
