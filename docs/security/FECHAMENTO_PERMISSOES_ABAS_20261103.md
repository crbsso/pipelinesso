# Fechamento das permissões por abas — 03/11/2026

> Correção posterior nesta data: as abas passaram a ser definidas somente no perfil. Ver [AJUSTE_HERANCA_PERFIL_20261103.md](AJUSTE_HERANCA_PERFIL_20261103.md). A descrição abaixo registra o fechamento anterior à retirada da seleção duplicada no usuário.

Worktree: pipelinesso-permissoes. Branch: feat/portal-sso-permissoes-20261029.

## Escopo desta entrega

O administrador cria e reutiliza perfis, marca suas capacidades e atribui aos usuários as abas e a vigência desejadas. A gestão já homologada foi preservada. As oito APIs operacionais, as quatro páginas de painéis e o menu agora verificam as concessões atuais. Administração e consulta são capacidades independentes. Login abre a página inicial, sem pressupor acesso a AVCB.

Esta versão libera todos os dados da aba concedida mediante abrangência corporativa explícita. Não implementa restrições por unidade. Concessões restritas anteriores permanecem armazenadas, não são convertidas e não liberam as abas. A interface não oferece novas restrições por unidade. Capacidades novas no perfil continuam exigindo abrangência na concessão da pessoa; a tela informa essa regra.

## Evidência local e real

- Suite final em 03/11/2026: 101 testes aprovados após o ajuste de textos. Verificação TypeScript sem diagnósticos.
- Compilação final de produção (Next.js/webpack) aprovada em 03/11/2026. Revisão ampla conserva quatro erros preexistentes de set-state-in-effect em DirecaoMotoristas, HistoricoMotoristas, VelocidadeMotoristas e AcoesCorretivasPainel, arquivos não alterados nesta entrega.
- HML: pipelinesso-homologacao (ckfsarzmudwdehiiltwi), PostgreSQL 17.11. A configuração de leitura existente na worktree de integração foi usada apenas no processo local; nenhum segredo foi copiado para arquivos versionados ou para o navegador.
- O usuário fez login com a conta de teste seguranca@celeogroup.com no portal local em 03/11/2026. Nenhuma senha foi coletada pelo agente.
- Perfil temporário teste_fechamento_abas_20261103: somente avcb.consultar, corporativa, com fim às 07h35min35s de Brasília. A vigência inicial foi antecipada dez minutos para acomodar a diferença de aproximadamente dois minutos entre o relógio local e o banco; o fim não foi ampliado. Não foi alterado o relógio nem a regra de autorização.
- Com a concessão ativa, AVCB mostrou os dados reais: 48 instalações na aba Gestão CELEO. O contexto liberou somente AVCB; Inspeções, Planos de Ação, Ações Corretivas, Motoristas e gestão permaneceram sem permissão.
- Endereço direto de Inspeções exibiu Acesso não permitido. As APIs não concedidas de Inspeções, Planos, Ações e Motoristas devolveram a negação de acesso, sem dados.
- Histórico, Direção e Velocidade continuaram bloqueados pelos gates de publicação existentes. A cobertura local testa as permissões dessas três rotas com gates liberados; nesta rodada real elas não foram publicadas nem tiveram leitura real homologada.
- Ao suspender o perfil e sua atribuição, a mesma sessão perdeu AVCB: API negada e página com Acesso não permitido, sem novo login. O perfil e a atribuição de teste terminaram inativos, preservando auditoria. As concessões originais não foram alteradas.

## Integração e implantação

As alterações desta entrega são do frontend, seus testes e esta documentação. Não houve mudança em BAT, ETL, marts ou configuração de produção. As três migrations do permissionamento já aplicadas em HML permanecem preservadas; esta etapa não acrescenta migration.

A branch local está baseada na integração e contém origin/main observado nesta sessão. A worktree pipelinesso-integracao tem alterações não commitadas de outra frente; nenhum merge deve misturá-las ou descartá-las. Destino do merge local: integracao/portal-sso-producao-20261028, branch da qual saiu esta worktree. Fazer somente avanço direto, conferindo antes e depois os hashes e o estado de todas as mudanças pendentes. Sem push ou deploy.

Produção exige suas configurações de sessão e de leitura no mesmo projeto, as migrations revisadas de gestão e o bootstrap explícito de administrador permanente. Não aplicar todo o histórico SQL por db push. Este fechamento não executa deploy, não concede perfis reais de negócio e não publica os módulos ainda em validação.

Recuperação: reverter o commit de integração por abas se necessário. Não remover o banco de permissões nem sua auditoria. Como o retorno ao frontend anterior elimina os novos bloqueios operacionais, manter o portal sem acesso público durante eventual recuperação até corrigir a autorização.
