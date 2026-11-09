# Convite para o Portal SSO — SSO-40

Modelo: invite.html. Assunto: Portal SSO | Crie sua senha.

Publicar primeiro a versão que aceita type=invite por POST em /auth/confirm. Depois aplicar este HTML no modelo Invite user do projeto correto. Site URL deve ser a origem do respectivo portal, sem barra final (PROD conferido: https://portal-ssovercelapp.vercel.app). O convite abre confirmação sem consumir token em GET; o POST valida e segue para /atualizar-senha com cookies.

Links antigos com ConfirmationURL e /aceitar-convite continuam tratados pela página legada. Novos convites precisam ser enviados pelo administrador/destinatário autorizado para validar a mudança; não reutilizar tokens reais durante testes.

Rollback de configuração: restaurar o assunto You've been invited e o HTML padrão com href="{{ .ConfirmationURL }}" documentado no Jira, antes de reverter a versão que suporta POST de convite. Rollback de código não desfaz configuração de e-mail.
