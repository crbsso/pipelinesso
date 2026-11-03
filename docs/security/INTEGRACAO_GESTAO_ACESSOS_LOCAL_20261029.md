# Integracao local da gestao de acessos — Portal SSO

Data: 29/10/2026. Worktree: pipelinesso-permissoes.
Branch: feat/portal-sso-permissoes-20261029.
Base: 73fbae339a7fe5643b973fa0e0c93cd5037f989b.
Estado atual em 30/10/2026: preparacao local e atualizacao pontual autorizada de dependencias concluidas; 75 testes, tipos, lint e build aprovados. Terceira migration e nova interface ainda sem homologacao remota; sem commit, push, PR ou deploy.

## Resultado e escopo

A tela de solicitacoes existente passou a usar a sessao da pessoa e a capacidade solicitacoes_acesso.gerenciar. Foram preparadas as telas Usuarios e Permissoes, com ativacao/bloqueio do cadastro no portal, perfis, capacidades, concessoes, abrangencias nativas, vigencia, suspensao/reativacao e auditoria.

As paginas e APIs verificam as capacidades a cada requisicao. A mudanca do menu acompanha as capacidades; o menu nao e uma fronteira de autorizacao. A area de configuracoes e os links de consulta anteriores nao foram redesenhados.

Esta entrega nao aplica o isolamento aos dados dos paineis operacionais. As consultas ainda precisam ser integradas e homologadas por modulo, incluindo totais, filtros, rankings, views e registros sem unidade. Essa limitacao esta explicitada nas telas. Preparar uma abrangencia nao comprova que uma API operacional ja a aplica.

BAT, ETL, classificacoes, marts, views e gates de Velocidade permanecem fora desta alteracao. Nenhuma conta Auth, senha, chave ou novo acesso remoto foi alterado nesta etapa. A concessao temporaria de HML validada anteriormente continua com o vencimento original.

## Arquivos principais

| Grupo | Arquivos |
| --- | --- |
| Banco local | supabase/migrations/20261030103220_integrar_gestao_acessos_portal.sql |
| Autorizacao HTTP | frontend/src/lib/gestao/http.ts e servidor.ts |
| Contratos e chamadas | frontend/src/lib/gestao/contratos.ts e cliente.ts |
| Paginas protegidas | frontend/src/app/(admin)/gestao/{usuarios,permissoes,solicitacoes-acesso}/page.tsx |
| Interfaces | frontend/src/components/gestao/* |
| APIs | frontend/src/app/api/gestao/* |
| Navegacao | frontend/src/layout/AppSidebar.tsx |
| Tipagem de SVG | frontend/src/svg.d.ts |
| Novos testes | frontend/tests/gestaoBanco.test.mjs, gestaoHttp.test.mjs, gestaoTelas.test.mjs |

O manifesto JSON em evidencias/INTEGRACAO_GESTAO_LOCAL_20261029.json registra SHA-256 dos arquivos selecionados. Arquivos novos ainda nao estao em commit; git diff --stat sozinho nao os inclui.

O conteudo cliente da tela de solicitacoes foi movido de page.tsx para GestaoSolicitacoes.tsx. A pagina agora possui protecao no servidor. Os filtros e as contagens sao consultados no servidor com paginacao, evitando contagens limitadas a uma pagina. Aprovacao continua sem provisionar conta ou conceder perfil.

O menu teve a selecao de submenu derivada da rota para passar a regra de React sem desabilitar o lint. A declaracao SVG anterior dizia que a importacao padrao era uma string, mas o projeto usa SVGR; foi ajustada para componente com SVGProps. Isso resolveu os erros de tipo existentes nos icones sem alterar os SVGs ou o comportamento de login.

## Fronteiras de seguranca

- As novas rotas administrativas usam somente o cliente SSR da sessao; nao criam cliente com secret/service_role.
- O carregador usa getUser e a RPC propria, sem parametro de identidade. A RPC de gestao obtem o ator somente de auth.uid().
- public.gerir_acessos_portal e SECURITY INVOKER. A entrada SECURITY DEFINER permanece em portal_acesso, com search_path vazio e autorizacao por operacao.
- authenticated recebe EXECUTE somente na entrada protegida e no wrapper. Auxiliares, tabelas privadas, anon e service_role nao recebem EXECUTE administrativo.
- Alterar concessoes exige usuarios.gerenciar e permissoes.gerenciar, tanto na rota quanto no banco.
- O banco reconfirma capacidade, identidade ativa, conta confirmada/apta e vigencia. Escritas revalidam a autorizacao antes e depois da espera pela trava transacional.
- Pedidos HTTP de escrita exigem origem exata, JSON e corpo de ate 64 KiB. Parametros fixos de rota nao podem ser substituidos pelo corpo.
- Os resultados sao private/no-store; erros internos nao sao enviados ao navegador.
- Versoes de cadastro/perfil/concessao sao conferidas antes de gravar. As versoes de perfil e concessao incluem seus filhos; uma edicao antiga recebe conflito em vez de sobrescrever silenciosamente.
- Nova identidade no portal recebe somente papel base USUARIO. A interface nao promove ADMIN_SSO legado.
- Concessoes exigem capacidades e escopos explicitos; novas concessoes nao marcam abrangencia corporativa nem permanencia automaticamente. Tuplas de coligada/secao permanecem separadas.
- Ao editar uma concessao cujo perfil perdeu capacidades, a tela informa que os escopos dessas capacidades serao retirados antes de salvar.
- Analise de solicitacao e auditada sem copiar sua justificativa ou dados pessoais para o registro generico da alteracao.

## Ultimo administrador permanente

A migration exige previamente uma pessoa ativa, confirmada e apta com as tres capacidades de gestao corporativa, perfis ativos, inicio vigente e atribuicoes sem vencimento. A migration interrompe se isso nao existir; nao faz bootstrap automatico.

Uma atribuicao temporaria, ainda que ativa, nao substitui a continuidade da administracao. Transferir a responsabilidade exige primeiro criar outro administrador permanente apto.

Todas as alteracoes nas cinco tabelas de configuracao usam uma trava transacional comum antes das escritas. Constraint triggers diferidos validam o estado final da transacao. Isso permite substituir escopos atomicamente e bloqueia a remocao do ultimo administrador por identidade, perfil, capacidade, abrangencia ou vigencia. A falha reverte tambem a auditoria.

Essa regra cobre a configuracao de acesso do portal. Bloqueios de contas executados fora desse fluxo no servico Auth exigem procedimento operacional proprio; a interface nao altera contas Auth. Superusuarios continuam responsaveis por manutencoes excepcionais do banco.

A logica de serializacao foi implementada, mas a disputa real entre duas sessoes PostgreSQL ainda precisa ser testada em HML. O teste local PGlite usa uma unica instancia/conexao.

## Validacao local

- 75 testes passaram apos a atualizacao: as 50 verificacoes anteriores, 24 da integracao inicial e uma verificacao adicional de lista/contagens da tela de solicitacoes.
- Banco descartavel PGlite 0.5.13 / PostgreSQL 18.6, somente em memoria. HML usa PostgreSQL 17; a terceira migration ainda precisa de homologacao nessa versao.
- Casos cobrem ausencia de identidade, capacidade independente, expiracao, tentativa de enviar ator/papel no corpo, escopos invalidos, auditoria e rollback, edicao antiga, transferencia da administracao e ausencia de bootstrap permanente.
- Testes HTTP cobrem origem, corpo limitado, dados invalidos, dupla capacidade, revogacao sem cache e protecao de detalhes internos.
- Testes de renderizacao usam os componentes reais com dados ficticios e verificam selecoes conservadoras, tuplas separadas, vencimento explicito e auditoria legivel. Nao sao teste interativo em navegador.
- TypeScript passou no projeto frontend completo.
- ESLint passou nos arquivos da integracao, paginas/APIs de gestao, menu e declaracao SVG.
- npm run build -- --webpack passou, incluindo as tres paginas de gestao como dinamicas.
- git diff --check passou. Avisos de conversao LF/CRLF sao do Git no Windows.
- O build informou multiplos lockfiles e selecionou a raiz desta worktree. Nao foram removidos lockfiles ou alterados controles de build.
- Nao houve teste visual/interativo da nova interface nem simulacao de sessao real nela; o controle da aba estava indisponivel. A tela local da etapa anterior e um teste separado, nao esta interface nova.

## Dependencias: situacao anterior e correcao aprovada

O npm audit, apos npm ci --ignore-scripts sem alterar o lockfile do frontend, informou 21 alertas: 1 critico, 13 altos, 3 moderados e 4 baixos. A versao usada na compilacao inicial era Next.js 16.1.6. Os manifests do checkout principal e da integracao tambem foram consultados somente por leitura e continuam declarando ^16.1.6; nenhum desses checkouts foi alterado.

O aviso oficial GHSA-p293-qw3h-jr36 afeta servidores Windows com Next.js >=16.0 e <16.3.3. O aviso oficial GHSA-673q-mjm6-r5xr indica Next.js 16.4.1 como versao corrigida para outra falha critica e recomenda atualizacao mesmo sem uso da funcionalidade vulneravel descrita. Isso e evidencia de dependencia afetada nesta worktree; nao e comprovacao de exploracao nem verificacao da versao efetivamente implantada em producao.

Fontes oficiais:
- https://github.com/vercel/next.js/security/advisories/GHSA-p293-qw3h-jr36
- https://github.com/vercel/next.js/security/advisories/GHSA-673q-mjm6-r5xr

Proposta posteriormente aprovada e executada nesta worktree: fixar Next.js e eslint-config-next em 16.4.1 e PostCSS em 8.5.23, atualizar somente os artefatos de dependencias necessarios nesta worktree e repetir auditoria, testes, lint, tipos e build. As versoes foram conferidas no registro npm; Next.js 16.4.1 aceita Node >=20.9 e React 19, compativeis com o ambiente observado. A proposta nao promete eliminar todos os alertas transitivos e nao inclui npm audit fix --force nem downgrade de SVGR.

A atualizacao recebeu aprovacao explicita do usuario. As copias pontuais dos manifests e do lockfile foram preservadas em .cache/atualizacao-dependencias-20261029, com hashes verificados. Nao foi executado audit fix --force nem alterada outra dependencia direta.

## Proxima homologacao — sujeita a autorizacao

1. Atualizacao pontual e checks locais concluidos em 30/10/2026. Classificar os 15 alertas restantes antes de publicacao; esta atualizacao nao equivale a auditoria sem pendencias.
2. Selecionar/congelar a versao candidata conforme governanca. Conferir alvo ckfsarzmudwdehiiltwi, estado das duas migrations ja aplicadas e existencia do administrador permanente. Nao escolher nova conta nem estender a concessao temporaria automaticamente.
3. Fazer inventario das funcoes/triggers/grants de acesso e das relacoes operacionais.
4. Aplicar exclusivamente a terceira migration revisada, mediante aprovacao. Nao executar db push/reset ou o historico inteiro.
5. Regerar o build com a configuracao publica HML explicita. Os testes de compilacao desta entrega nao definem ambiente de deploy nem configuram login real.
6. Testar getUser/cookies/rotas/RPC, capacidades independentes, CSRF, aprovacao de solicitacao sem provisionamento e autoria no banco.
7. Tentar bloquear/revogar/expirar o ultimo administrador permanente; confirmar conflito, continuidade e rollback da auditoria. Testar duas sessoes concorrentes e fingerprint antigo.
8. Confirmar dados operacionais e grants preservados. Rodar advisors e classificar somente mudancas desta migration.
9. Validar interface com dados ficticios autorizados e conta de teste; revalidar expiracao/revogacao real. Registrar evidencias.
10. Depois do aceite, preparar revisao/PR e plano de implantacao. PROD permanece sob autorizacao propria.

## Recuperacao

Agora: reverter somente os arquivos desta etapa por diff/backup selecionado, preservando o pacote anterior e as demais worktrees. Nao usar reset/clean/stash ou sincronizacao de pastas inteiras.

Depois de uma eventual aplicacao da terceira migration: preservar concessoes/auditoria, bloquear mudancas administrativas durante a recuperacao e revisar uma reversao pontual de funcoes/triggers. Nao usar DROP CASCADE ou remover os registros. Reverter as rotas junto da camada de banco; o modelo legado sozinho nao substitui as capacidades e os escopos.

A seguranca dos dados operacionais e a implantacao completa do portal continuam pendentes.

## Atualizacao pontual concluida em 30/10/2026

O usuario autorizou fixar Next.js e eslint-config-next em 16.4.1 e PostCSS em 8.5.23, somente nesta worktree. As versoes instaladas foram conferidas, os demais manifests/dependencias diretas foram preservados e o lockfile registrou as transitivas necessarias. Foram adicionados dois pacotes, removido um e alterados 34 na instalacao.

A nova regra de lint identificou estado atualizado sincronamente no efeito da tela de solicitacoes. O carregamento passou ao mesmo hook de consulta da integracao, preservando filtros, paginacao, tratamento de erro e contagens do servidor. Um teste adicional renderiza a tela real com dados ficticios para confirmar que os totais nao sao recalculados apenas pela pagina. Nenhuma regra de qualidade foi desabilitada.

A validacao final passou: 75 testes, TypeScript, lint dos arquivos da integracao e build Next.js 16.4.1 com webpack. A auditoria final de 30/10/2026 passou de 21 registros (um critico) para 15 registros, sem criticos: nove altos, dois moderados e quatro baixos. Next.js e PostCSS nao constam mais entre os pacotes com alerta. Os registros restantes sao de outras transitivas/ferramentas e nao foram corrigidos automaticamente; nao se declara auditoria zerada ou liberacao de producao.

A evidencia completa esta em evidencias/DEPENDENCIAS_FRONTEND_20261030.json. O manifesto da integracao teve somente quatro hashes alterados: os dois arquivos de dependencias, a tela de solicitacoes e o teste adicional. Recuperacao das dependencias: restaurar apenas package.json/package-lock.json das copias verificadas e reinstalar pelo lockfile, preservando o permissionamento. A pequena adequacao de carregamento usa o hook ja existente e nao precisa ser removida para esse rollback.

Nenhuma migration foi aplicada em HML/PROD nesta etapa. A terceira migration e a interface ainda precisam da homologacao descrita acima. A configuracao e os codigos dos demais checkouts nao foram alterados.

## Pre-conferencia somente de leitura — 30/10/2026

Em 30/10/2026 as 07h18 de Brasilia, a consulta a HML confirmou: a nova entrada de gestao ainda nao esta instalada; existe um administrador permanente elegivel; a conta de teste continua confirmada, ativa e com atribuicao vigente ate 30/10/2026 15h43m20,625s de Brasilia. A evidencia esta em evidencias/PRE_GESTAO_HML_20261030.json. Nenhuma escrita remota foi realizada.

Proxima proposta: congelar o candidato em commit local com arquivos selecionados e autorizar a aplicacao exclusiva da terceira migration e testes das tres areas de gestao em HML, com mesmo candidato. Reconfirmar o estado e a validade da conta no inicio; nao renovar a concessao sem autorizacao. Sem push, merge ou implantacao em producao nesta proposta.

## Aplicacao autorizada em HML — 30/10/2026

O usuario autorizou o commit local e a aplicacao exclusiva da migration de gestao. Candidato inicial: 81b5a013d3b9828273d18e7871e3a05c8eb41155. Aplicacao confirmada pelo Supabase, versao remota 20261030103220. O arquivo local foi renomeado para essa versao, preservando integralmente o conteudo SQL (SHA-256 92ea6e55cc2f035ab45bf10cfcd90b5ccf33339cfb6a8c5b77ffec7d939c6814). Sem db push, alteracao de historico remoto, push, merge ou producao.

Estado atualizado e pendencias: consultar HOMOLOGACAO_GESTAO_20261030.md. Aplicacao HML concluida; consulta das tres telas com login real confirmada pelo usuario em 30/10/2026. Gravacoes pela interface e concorrencia real permanecem pendentes. O erro inicial foi identificado no painel AVCB, fora destas tres telas.

Confirmacao adicional em 30/10/2026: criacao, edicao de descricao e desativacao de perfil vazio concluidas pelo usuario com login real e autoria conferida no banco. Perfil de teste final inativo, zero capacidades, zero atribuicoes; tres eventos de auditoria, total persistente 21. Concessoes/analise pela interface e concorrencia real continuam pendentes. Ver HOMOLOGACAO_GESTAO_20261030.md e evidencias/GRAVACOES_GESTAO_20261030.json.

Concorrencia confirmada em 30/10/2026: manutencao SQL e interface autenticada executadas pelo agente em duas sessoes reais. Espera na trava comprovada, versao antiga rejeitada e versao atual preservada. Perfil de teste continua inativo, sem capacidades/atribuicoes; 22 auditorias, sem evento para a tentativa rejeitada. Ver HOMOLOGACAO_GESTAO_20261030.md e evidencias/CONCORRENCIA_GESTAO_20261030.json. Concessoes e analise pela interface continuam pendentes.

Atualizacao de 30/10/2026: cenarios administrativos desta rodada concluidos pela interface e conferidos no banco. Concessao redundante temporaria criada/editada/suspensa/reativada; estado final suspenso e perfil inativo sem capacidades ativas. Duas solicitacoes ficticias analisadas com autoria e sem provisionamento automatico. Estado final: duas contas Auth; tres atribuicoes (originais intactas e teste suspenso); 38 auditorias. Evidencia FLUXOS_ADMINISTRATIVOS_GESTAO_20261030.json. Matriz real e isolamento dos paineis permanecem pendentes.
