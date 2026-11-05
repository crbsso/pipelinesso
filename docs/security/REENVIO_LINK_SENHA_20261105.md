# Reenvio de link para conta confirmada — 05/11/2026

A confirmação do e-mail não comprova que a pessoa definiu a própria senha. O reenvio anterior apenas retornava CONTA_EXISTENTE para contas confirmadas, sem enviar mensagem.

O comando explícito REENVIAR_CONVITE agora usa recuperação/definição de senha quando a conta já está confirmada. A aprovação inicial de conta confirmada preserva o login existente e não envia redefinição sem pedido. Contas não confirmadas continuam recebendo convite.

A tela mantém disponível o botão de envio para contas confirmadas. O servidor usa exclusivamente o destinatário validado no banco, preserva perfis e validade, revalida as capacidades de gestão e registra o resultado na tentativa existente. ENVIADO significa solicitação aceita pelo serviço, não comprovação de entrega na caixa postal.

O retorno de recuperação é aceito tanto por token_hash quanto por fragmento. O encaminhamento da URL principal suporta invite e recovery. Os tokens são removidos da URL antes da inicialização do cliente, a identidade é validada e o destino continua sendo a definição de senha. O cliente de envio usa fluxo implicit, sem gerar um verificador PKCE no servidor que faltaria no navegador do destinatário.

Verificação: 150 testes aprovados; lint dos arquivos alterados e compilação de produção aprovados. Inclui reenvio confirmado, falha do provedor, preservação de perfil, retorno recovery nos dois formatos e disponibilidade do botão.

Nenhum e-mail real foi enviado pelos testes. A confirmação de entrega exige envio autorizado e verificação pelo destinatário. Nenhuma alteração de schema, perfil ou validade nesta correção.

Referências:
- https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail
- https://supabase.com/docs/guides/auth/auth-email-templates
