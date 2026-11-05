# Aprovação com perfil e convite — 05/11/2026

O fluxo anterior alterava somente o status da solicitação. Não criava conta, vínculo de perfil ou convite.

A aprovação passa a exigir perfil ativo e validade explícita (vencimento ou Sem vencimento). O servidor usa o destinatário registrado na solicitação; o cliente não pode escolher outro e-mail. A conta nova permanece não confirmada até a validação do convite.

A API cria a conta sem enviar e-mail, registra o perfil e a aprovação em transação e somente depois solicita o convite ao Supabase Auth. Falha no envio não é apresentada como envio concluído: fica registrada e a tela permite reenviar. Contas já confirmadas continuam com o login existente. Vínculos ativos existentes mantêm sua validade.

Solicitações antigas APROVADO sem liberado_em podem concluir a liberação pela mesma tela, com escolha explícita do perfil. Nenhuma aprovação anterior recebeu perfil automaticamente.

Segurança:
- Sessão atual e gestão corporativa de solicitações, usuários e permissões na API e novamente no banco.
- Proteção de origem, limite de corpo, destinatário e identidade validados, concorrência otimista e trava compartilhada da gestão.
- Reenvio limitado a um minuto e correlacionado à tentativa atual; bloqueio/revogação impede novo convite.
- Helper privado SECURITY INVOKER sem EXECUTE para anon/authenticated/service_role; mantém o despachante protegido existente, com search_path vazio e RLS.
- Nenhuma chave administrativa nem token de primeiro acesso devolvido pela API ao navegador do gestor.
- Link aceita o convite padrão com fragmento ou token_hash; remove os tokens da URL, valida a identidade e leva à definição da senha. Também encaminha retornos do provedor à URL principal para a página de convite.

Validação:
- 146 testes aprovados, incluindo aprovação transacional, perfis, origem, falhas de envio, reenvio, conta confirmada, telas e tokens.
- ESLint dos arquivos alterados e compilação de produção aprovados.
- Migração conferida em pipelinesso-homologacao (ckfsarzmudwdehiiltwi). RPC real executada como authenticated em transação revertida: perfil escolhido, solicitação anteriormente aprovada, identidade, registro da tentativa e bloqueio de reenvio.
- Zero fixtures remanescentes; RLS ativo; ACL do helper privada. Nenhum novo apontamento do advisor para o helper.
- Testes de envio usam cliente simulado. Nenhum e-mail real foi enviado e a solicitação de produção não recebeu perfil durante a implementação. A entrega na caixa do destinatário só pode ser confirmada depois do envio autorizado pelo gestor.
