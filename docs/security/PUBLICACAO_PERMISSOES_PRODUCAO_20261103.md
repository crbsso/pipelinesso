# Publicação das permissões — 03/11/2026

Estado: banco de produção e configuração Vercel preparados. PR e merge serão feitos pelo usuário no terminal do VS Code. O site continua na versão anterior até o merge na main.

## Versão de publicação

Branch release/portal-sso-permissoes-20261103, criada sobre origin/main 189c8dd. O commit de código fab4b86 contém o mesmo frontend homologado em d7967c0, com 104 testes e compilação já aprovados. Não contém diferenças de backend ou BAT em relação à produção. A branch de integração do pipeline não foi movimentada nesta preparação.

Vercel: equipe seguranca-celeo, projeto portal-sso.vercel.app, domínio https://portal-ssovercelapp.vercel.app. A prévia do commit de código compilou com sucesso (8uFB3reC7A8ZVZbvqB9EzG46yn6f). Foi configurado PORTAL_SSO_ORIGIN=https://portal-ssovercelapp.vercel.app, tipo Config e ambiente Production; o próximo deploy aplicará essa configuração. As chaves existentes e as flags de publicação foram preservadas.

## Banco de produção preparado

Projeto Supabase lkhidajhsqgebjltyicb, PostgreSQL 17.6. As quatro migrations foram aplicadas individualmente, sem db push. Entre a segunda e a terceira, foi executado o bootstrap revisado em supabase/reviews/permissionamento/bootstrap_administracao_producao_20261103.sql. O roteiro completo foi validado em PostgreSQL descartável antes da aplicação.

| Migration | Versão local/HML | Versão registrada em produção |
| --- | --- | --- |
| preparar_gestao_acesso_portal | 20261029161856 | 20261103120926 |
| criar_permissionamento_portal | 20261029162052 | 20261103120929 |
| integrar_gestao_acessos_portal | 20261030103220 | 20261103120957 |
| herdar_permissoes_do_perfil | 20261103110106 | 20261103121006 |

O conector atribuiu as versões de produção. Os arquivos locais mantêm as versões canônicas de HML; este mapa identifica a mesma aplicação SQL em cada ambiente. Não executar db push ou reparar o histórico automaticamente: uma futura migração exige conferir este mapa antes de reaplicar SQL.

A conta seguranca@celeogroup.com já era a administradora ativa no modelo legado de produção. Essa administração foi preservada com o perfil administracao_acessos e apenas as três capacidades de gestão, em vínculo permanente herdado do perfil. Não foram criadas contas, alteradas senhas ou copiados perfis de teste. Existem duas contas Auth e três solicitações, como antes. O cadastro legado de identidade permaneceu idêntico.

As definições, RLS e grants das relações públicas operacionais e as definições/grants das funções públicas anteriores conservaram seus hashes. As RPCs novas negam execução anônima. A verificação administrativa com JWT simulado em transação confirmou contexto com as três capacidades, listagem de duas contas e um perfil; isso não representa login HTTP real. O usuário dispensou o teste manual adicional. Não foram introduzidos avisos novos no advisor: os quatro avisos anteriores permanecem fora deste escopo; os informativos de RLS sem política passaram de 32 a 37 pelas cinco tabelas privadas novas.

Depois da publicação, seguranca poderá criar perfis de consulta e vinculá-los às contas desejadas. O bootstrap concede gestão, sem presumir quais abas de consulta o administrador quer distribuir.

## PR e merge pelo usuário

Criar o PR de release/portal-sso-permissoes-20261103 para main. Título sugerido: Permissões por perfil nas abas e consultas do Portal SSO.

A descrição deve informar que o perfil define as abas e o usuário recebe o perfil, com herança das alterações; o menu, páginas e APIs verificam as concessões atuais. Registrar os 104 testes, compilação e homologação, a preparação de produção acima e a exclusão de BAT, ETL e backend.

O usuário fará o merge pelo terminal na worktree pipelinesso-permissoes. A main remota observada antes desta entrega é 189c8dd. Conferir uma worktree limpa e o PR antes de integrar. A Vercel publica a main automaticamente; não promover a prévia manualmente.

## Recuperação

A publicação anterior é Gn38CGyaQynHbJz22AfCAedLD8qA (189c8dd). Conservar o banco novo e sua auditoria se for necessário reverter o frontend. Um retorno ao frontend anterior retira os bloqueios novos das consultas; manter o portal sem acesso público durante eventual recuperação, até restabelecer a autorização. Não remover schemas, concessões ou auditorias por rollback genérico. A configuração de origem pode permanecer: o frontend anterior não a utiliza.

Evidências resumidas: evidencias/PUBLICACAO_PERMISSOES_PRODUCAO_20261103.json.
