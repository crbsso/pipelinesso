# Retomada do piloto Intranet - 04/11/2026

## Estado verificado

- Projeto Supabase: pipelinesso-homologacao (ckfsarzmudwdehiiltwi), ativo.
- Consulta somente leitura: tabelas stg_inspecoes_manutencao e mart_inspecoes_manutencao existem e estavam vazias. A RPC promover_inspecoes_manutencao(uuid,integer,date,date) existe.
- A consulta SQL Server com validacao normal do certificado falhou por cadeia nao confiavel. A extracao foi realizada com a opcao temporaria PermitirCertificadoTemporario, autorizada para esta consulta. Nao houve alteracao permanente de configuracao.
- Arquivo local ignorado pelo Git: data/bronze/inspecoes_intranet_202610_retomada.json.
- Janela: 2026-10-01 inclusivo ate 2026-11-01 exclusivo.
- 740 registros, seis familias. Conferencias de outubro aprovadas: 185 cintos, 19 acessorios, 60 locais de extintores e 111 veiculos distintos nas modalidades mensais.
- SHA256 identico ao previsto pelo publicador: 4DC1AC209991D6482E5CA8E783DB06CC14C5FBB256383BDC823A4BB0CDEE8F9D.
- Metadado fuso_origem do arquivo original: nao_verificado. O arquivo foi preservado.

## Correcao local

O publicador exigia simultaneamente a assinatura acima e um metadado de fuso diferente daquele contido nesse mesmo arquivo. Alterar o arquivo para declarar um fuso invalidaria sua assinatura.

O publicador agora aceita uma confirmacao externa explicita pelo argumento --confirmar-fuso-origem America/Sao_Paulo, somente quando o metadado original e nao_verificado. Um fuso divergente continua bloqueado. Assinatura, quantidade, familias e quality gate continuam obrigatorios.

Validacao: 14 testes aprovados (oito existentes e seis novos). A tentativa de validar o arquivo real sem confirmacao de fuso foi bloqueada como esperado. Nao foi executada publicacao.

## Proxima etapa

1. Confirmar com o responsavel pela fonte que Preenchido em representa horarios America/Sao_Paulo; o fuso do computador ou do servidor sozinho nao comprova isso.
2. Apos a confirmacao, executar o publicador em modo de validacao local, com --arquivo data/bronze/inspecoes_intranet_202610_retomada.json e --confirmar-fuso-origem America/Sao_Paulo, sem --publicar-hml.
3. Obter autorizacao para gravacao na homologacao: a autorizacao anterior do Supabase foi explicitamente somente leitura. Revalidar staging e mart antes da primeira carga.
4. Depois da homologacao, planejar integracao ao pipeline e ao portal. Nao alterar o BAT que esta sendo atualizado em outra frente.

Pendencias de infraestrutura: providenciar cadeia de certificado SQL confiavel para a operacao regular. A excecao temporaria nao foi configurada como padrao.

## Confirmacao posterior nesta retomada

O usuario confirmou que os horarios das inspecoes estao no fuso de Brasilia (America/Sao_Paulo). A validacao completa do arquivo real com --confirmar-fuso-origem America/Sao_Paulo passou: QUALITY_GATE APROVADO, 740 registros, seis familias e assinatura original conferida. Modo somente validacao local; Supabase nao acessado pelo publicador. As etapas 1 e 2 acima estao concluidas. Pendente: autorizacao explicita para gravar a carga na homologacao.

## Publicacao concluida em homologacao

O usuario autorizou explicitamente a publicacao dos 740 registros. Carga realizada no projeto ckfsarzmudwdehiiltwi pela conexao Supabase, apos nova validacao do arquivo e conferencia de tabelas vazias. Insercao e promocao pela RPC existente executadas em transacao unica, protegida por bloqueio das duas tabelas.

Carga: 71873896-846e-40db-a21d-735cc03b4dec.

Conciliacao independente apos a publicacao: 740 registros em staging e 740 na mart, 740 chaves distintas, seis familias, zero diferencas entre staging e mart, zero registros fora de outubro. Referencias confirmadas: 185 cintos, 19 acessorios, 60 locais de extintores, 111 veiculos mensais distintos. Staging preservada para rastreabilidade.

RLS permanece ativo nas duas tabelas; anon e authenticated nao possuem SELECT nessas tabelas. Nenhuma permissao foi alterada nesta carga.

Evidencia: docs/PUBLICACAO_INTRANET_HML_20261104.json.

A etapa de carga e conciliacao em homologacao esta concluida. A integracao ao pipeline e ao frontend continua como proxima etapa; producao nao foi alterada.
