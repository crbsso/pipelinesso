# Permissões definidas no perfil — 03/11/2026

A seleção individual de abas no cadastro do usuário era redundante. O formulário agora permite somente escolher o perfil, definir início/vencimento e ativar ou suspender o vínculo. As capacidades ficam exclusivamente no editor de perfil e são herdadas dinamicamente pelos usuários vinculados. Um perfil pode ser reutilizado por várias pessoas.

A migration 20261103110106_herdar_permissoes_do_perfil.sql acrescenta herdar_perfil em portal_acesso.atribuicoes e adapta a consulta do contexto e as verificações administrativas. Não acrescenta função pública, grant, schema exposto nem chave no navegador. As funções mantêm sua identidade, privilégios, search_path vazio e controles anteriores. A proteção do último administrador considera também os vínculos herdados.

O formato antigo permanece compatível para preservar restrições e seleções parciais existentes. Só os vínculos antigos que já possuíam todas as capacidades do perfil com abrangência corporativa foram convertidos automaticamente. Não houve mudança dos acessos atuais, estado ou vigência. Ao editar e salvar um vínculo parcial antigo, a interface informa expressamente a adoção das permissões integrais do perfil. O novo formulário sempre envia herdarPerfil=true e não envia abrangencias. Uma chamada antiga não consegue substituir um vínculo herdado por permissões individuais.

## Validação

- Suite completa: 104 testes aprovados. Após acrescentar a conversão equivalente dos vínculos antigos, os 15 testes de banco foram repetidos e aprovados, incluindo comparação exata do contexto antes/depois.
- TypeScript e ESLint nos arquivos alterados sem erros; compilação de produção aprovada.
- HML PostgreSQL 17: migration aplicada e nome local reconciliado com a versão remota 20261103110106. Quatro vínculos existentes convertidos; hashes dos contextos das duas contas idênticos antes/depois. Concessão administrativa temporária de seguranca preservada até 04/11/2026 às 07h41 de Brasília.
- RPCs reais de HML, com identidade JWT simulada em transação: mesmo perfil em duas contas sem abrangências individuais; substituição de AVCB por Inspeções refletida nos dois contextos; suspensão do vínculo observada. Tudo revertido por ROLLBACK, incluindo perfis, vínculos e auditoria fictícios.
- A primeira execução desse teste transacional foi rejeitada corretamente por formato UTC inválido no roteiro. Corrigido o roteiro para o formato aceito; a repetição passou e não deixou dados persistentes.
- Sessão real do navegador: formulário simplificado confirmado com apenas um seletor de perfil, sem controles de abas por pessoa. Posteriormente, o vínculo de Teste 2 03.11.26 para vinicius.brum@celeogroup.com foi confirmado salvo na interface e no banco: perfil ativo, vínculo ativo, início imediato, sem vencimento, herdar_perfil=true e zero seleções individuais. A autoria registrada é seguranca@celeogroup.com.
- O usuário dispensou expressamente o teste manual adicional de login com vinicius.brum@celeogroup.com e solicitou seguir. Esse login não foi realizado nem apresentado como validação. Permanecem válidas as verificações automatizadas, as RPCs de HML, a conferência do vínculo e os testes reais de consulta/revogação anteriores documentados. A frente de permissões por perfil foi encerrada nesse escopo.

As abas de Histórico, Direção e Velocidade conservam os gates de publicação anteriores. Produção, BAT, ETL e dados operacionais não foram alterados. A versão foi disponibilizada no portal local de HML para o usuário continuar o teste.

Integração: commit próprio nesta worktree e merge local na branch de integração, preservando os arquivos pendentes da outra frente. Sem push ou deploy em produção.
