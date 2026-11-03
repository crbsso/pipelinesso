# Perfis: exclusão, seleção legível e catálogo completo — 03/11/2026

Branch: `fix/perfis-exclusao-administracao-20261103`. Base: `97cd437`.
O usuário fará o PR e o merge.

## Resultado
- Exclusão confirmada somente quando o perfil não possui nenhum vínculo, incluindo suspensos e vencidos.
- Se houver usuários, o portal orienta atribuir outro perfil em Gestão de usuários. A regra é revalidada no banco.
- Editar vínculo permite transferir o usuário para outro perfil, preservando identidade, validade e estado.
- Não permite vínculos duplicados nem remover o último administrador permanente.
- Edição do cadastro atual a partir do histórico; registros históricos de inclusão, alteração e exclusão preservados.
- Seleção de perfil em cartões com nome e descrição, sem seleção de permissões por usuário.
- Catálogo de 19 capacidades em criar/editar perfil e ações Marcar todas/Desmarcar todas.
- As oito opções sem página são exibidas como Em preparação, sem links que levariam a 404, conforme escolha do usuário.
- Autorizações seguem as capacidades e a vigência do perfil; nomes de perfil não concedem privilégios.

## Verificação
109 testes passaram (incluindo PostgreSQL descartável), compilação Next/TypeScript e ESLint dos arquivos alterados.
A criação de perfil com 19 capacidades e exclusão de perfil vazio foram executadas pelas RPCs reais em HML, em transação com rollback.
Advisors de produção sem avisos novos; privilégios das funções privadas preservados.

## Banco e publicação
Migration local: `20261103122538_gerir_exclusao_perfis.sql`.
Aplicada em HML e em produção. Versão registrada em produção: `20261103125153`.
A migration substitui quatro funções existentes, sem novas permissões de tabela/RPC, sem excluir perfis nem alterar vínculos.
Produção continuou com 2 perfis, 1 vínculo e 31 eventos de auditoria após a migration.

A correção anterior do perfil Administração de acessos (3 para 11 capacidades) já está em produção e foi feita pela RPC auditada a pedido do usuário.
A conta seguranca possui vínculo ativo herdado; vinicius.brum estava sem vínculo na conferência.

## Passo obrigatório após merge
1. Confirmar que a Vercel publicou o commit com este catálogo novo.
2. Executar `supabase/reviews/permissionamento/completar_abas_administrativas_20261103.sql`.
3. Confirmar 19 capacidades para Administração de acessos e Administrador e conferir o menu.
A etapa 2 fica pendente até a publicação: NÃO antecipar, pois a versão anterior rejeita módulos desconhecidos no contexto.
Não executar db push no histórico inteiro; a versão remota da migration difere da versão local.
