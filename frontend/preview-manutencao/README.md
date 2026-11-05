# Prévia das Inspeções da Manutenção

Prévia local, em http://127.0.0.1:3010, com seis gráficos independentes e filtros mensal/trimestral/anual, concessão, localização e modalidade.

Executar a partir de frontend:
node node_modules/next/dist/bin/next dev preview-manutencao --hostname 127.0.0.1 --port 3010

Usa dados reais extraídos do SQL Server, sem relação com Prevsys. Nenhuma credencial é enviada ao navegador. Não altera autenticação ou Supabase.

Fontes locais ignoradas pelo Git, em data/bronze:
- inspecoes_intranet_previa_20261105.json: formulários de 01/09 a 05/11/2026.
- metas_os_previa_20261105.json: OS dos planos 197 e 143 de setembro a novembro.
- atividades_metas_inspecoes_previa_20261105.json: 574 atividades não excluídas das OS, nas tabelas originais acessadas pelas visões existentes.

Metas dos gráficos: atividades de inspeção do PE-017 por data prevista atual da OS, com IDs 7911 (cintos/EPIs), 7913 (carga), 7915 (ferramentas), 7917 (instalações), 7918 (extintores), 7919 (veículos). Atividades de APR e identificação por cores são excluídas da seleção. Realizado: status 2, conferido com o rótulo Concluído no relatório SQL para a mesma atividade da OS 1. Não há datas de conclusão preenchidas nessa extração, portanto não se calcula conclusão no prazo.

Saldo = atividades previstas menos atividades no status 2; estados diferentes de 1 e 2 são indicados separadamente e sua interpretação de negócio continua pendente para homologação. Os formulários não são somados às atividades para calcular execução. Não há meta por formulário individual, portanto selecionar modalidade específica não reaproveita indevidamente a meta global da família.

Metas e zero de programação somente no intervalo completo extraído (setembro a novembro); meses fora dele permanecem sem meta. As visões trimestral e anual mostram disponibilidade parcial quando aplicável.

Outubro/2026: EPIs 54/53, carga 54/46, ferramentas 54/53, instalações 54/53, extintores 57/55, veículos 57/53 (meta/realizado em atividades de OS). Estados ainda não classificados no saldo: carga 7, extintores 1, veículos 3.

A integração da programação na API/Supabase, os testes de homologação e a produção aguardam aprovação da prévia.
