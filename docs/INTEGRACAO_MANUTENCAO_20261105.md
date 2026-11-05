# Integração do painel da Manutenção

Worktree: pipelinesso-sqlserver. Processo independente do Prevsys.

A interface aprovada possui seis gráficos de meta e realizado, filtros mensal/trimestral/anual, concessão e localização. O realizado dos gráficos usa atividades das OS, não o volume de formulários. Status 2 foi conciliado com o rótulo Concluído no SQL. Outros estados aparecem no saldo e são informados separadamente; não se infere atraso sem data de conclusão.

A API de Manutenção conserva a autorização existente da aba e o cache privado. Lê snapshots mensais do Supabase somente no servidor; credenciais privilegiadas nunca chegam ao navegador. Sem snapshot, mantém a consulta das inspeções já homologada. O recurso é liberado apenas nos projetos validados: homologação ckfsarzmudwdehiiltwi e produção lkhidajhsqgebjltyicb. Outros projetos continuam bloqueados.

Carga: backend/intranet/painel_manutencao.py e extrair_painel_manutencao.ps1.
O extrator consulta o SQL somente em leitura, com janelas de meses completos até 93 dias e confirmação de fuso. A exceção temporária de certificado exige opção explícita. A tabela de relatório com 1,6 bilhão de linhas não é utilizada. As seis atividades são obtidas da tabela original referenciada pelas visões existentes.

Exemplo, a partir da raiz do projeto:

    python backend/executar_pipeline_sso.py --manutencao --painel-completo-manutencao --arquivo-intranet data/bronze/painel_novo.json --inicio-intranet 2026-09-01 --fim-intranet 2026-12-01 --confirmar-fuso-origem America/Sao_Paulo --extrair-intranet

Acrescentar --permitir-certificado-temporario somente para a exceção autorizada. Para publicar em HML, acrescentar --publicar-manutencao-hml e configurar SUPABASE_URL e SUPABASE_SECRET_KEY no ambiente do publicador. A URL é conferida contra a homologação; outra URL é bloqueada. Dados, arquivos de carga e segredos são ignorados pelo Git. O BAT atualizado em outra frente não foi modificado.

A publicação usa RPC atômica, separa competências completas, rejeita duplicações e impede uma carga antiga de substituir outra mais nova. Não altera a mart do Prevsys nem a mart de inspeções da Manutenção anteriormente publicada. Snapshots mensais possuem RLS e acesso exclusivo a service_role.

A prévia local usa o mesmo cálculo puro que a API. Campos sem meta específica por formulário não recebem a meta agregada indevidamente. Meses fora da cobertura extraída continuam sem dados e recortes parciais são sinalizados.

Validação desta entrega: ver o registro de homologação e os resultados dos testes anexados após sua execução.

Publicação em produção aprovada em 05/11/2026: usar --publicar-manutencao-prod --confirmar-producao lkhidajhsqgebjltyicb junto com --manutencao --painel-completo-manutencao. Os modos HML e produção são mutuamente exclusivos; a URL deve corresponder ao projeto confirmado. As credenciais permanecem no ambiente do publicador.
