# Homologação da Manutenção — 05/11/2026

Projeto confirmado: pipelinesso-homologacao, ckfsarzmudwdehiiltwi.

- Extração SQL completa: 1.090 formulários, 171 OS e 574 atividades, de setembro a novembro/2026.
- Publicação mensal atômica pela RPC executada como service_role: três competências.
- Setembro: 251 formulários, 57 OS, 130 atividades.
- Outubro: 740 formulários, 57 OS, 330 atividades.
- Novembro: 99 formulários, 57 OS, 114 atividades; realizações parciais na data da extração.
- As assinaturas SHA256 gravadas foram conciliadas com os três arquivos mensais preparados.
- Outubro, meta/realizado por atividade: EPIs 54/53; carga 54/46; ferramentas 54/53; instalações 54/53; extintores 57/55; veículos 57/53.
- Estados não classificados como concluídos ou pendentes na origem: carga 7, extintores 1, veículos 3. Permanecem explicitamente destacados no saldo.
- A mart de inspeções da Manutenção anterior permanece com 740 registros. Prevsys não foi alterado pela carga.
- RLS ativo; anon e authenticated sem SELECT e sem EXECUTE da nova RPC; função SECURITY INVOKER.
- Testes reais da RPC rejeitaram carga antiga, competência duplicada e JSON incompleto, com rollback integral.
- A assessoria de segurança informa apenas RLS sem policy para a tabela nova. Isso é intencional: os clientes não consultam a tabela; somente service_role no servidor. Referência: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy
- Testes locais: 25 do backend e 126 do frontend/permissões aprovados.
- Build Next.js 16.4.1 e verificação TypeScript concluídos. Nenhum segredo foi incluído no repositório.

A integração usa o mesmo cálculo puro na API e na prévia. O pipeline principal foi validado no modo --manutencao --painel-completo-manutencao sem publicar em produção.