# Proposta de matriz e piloto AVCB — 30/10/2026

Estado: proposta para decisao de negocio; nenhuma regra ou concessao real aplicada nesta etapa.

## Base verificada em HML

A consulta somente de leitura em 2026-10-30 16:41:20.852487+00 encontrou 63 registros, 16 projetos e 60 nomes distintos de subestacao. Existem 3 nomes de subestacao em mais de um projeto. Os campos nativos projeto/subestacao/instalacao nao apresentaram valores vazios nesta fotografia; as 63 combinacoes completas sao distintas.

O campo instalacao possui somente Acessante (41 registros) e Propria (22 registros, grafia original na evidencia). Ele nao e uma chave unica de unidade. Esta constatacao corrige a interpretacao preliminar de que esse campo poderia identificar sozinho uma instalacao especifica.

Fonte: public.mart_avcb, projeto Supabase HML ckfsarzmudwdehiiltwi. Nao foram consultados nomes de responsaveis nem definidos acessos por cargo, empresa ou email.

## Recomendacao a confirmar

A capacidade e avcb.consultar. O perfil reune capacidades; a concessao da pessoa define abrangencia e vigencia.

| Modo de consulta | Regra proposta |
| --- | --- |
| Corporativa | Todas as linhas AVCB, somente quando explicitamente concedida |
| Projeto(s) | Somente projetos selecionados por quem administra os acessos |
| Subestacoes selecionadas | Somente pares completos projeto + subestacao; cada par e uma unidade autorizada |
| Classificacao de instalacao | Acessante/Propria como restricao adicional ao escopo organizacional, quando necessaria |
| Sem concessao valida | Negar consulta, inclusive acesso direto a API |

Recomendacao de padrao: projetos selecionados, com possibilidade de detalhar subestacoes. Alternativa: exigir sempre pares projeto + subestacao. Essa decisao ainda precisa de confirmacao do usuario.

Os publicos candidatos ja discutidos podem receber abrangencias diferentes. Ainda e preciso decidir quais pessoas terao consulta corporativa, quais projetos/subestacoes serao atribuidos e quais capacidades comporao os perfis reais. Administrar acessos permanece separado de consultar AVCB.

## Alcance tecnico proposto para o piloto

- Integrar a autorizacao atual ao servidor/banco da consulta AVCB, exigindo identidade verificada, capacidade ativa e abrangencia valida.
- Restringir linhas antes de entregar detalhes, total, indicadores ou opcoes dos filtros. Filtros da tela apenas refinam o escopo autorizado.
- Preservar pares de atributos e negar valores/concessoes invalidos. Nunca obter acesso corporativo a partir de lista vazia.
- Manter vigencia, revogacao, usuario/perfil ativo e autoria sem confiar em dados de autorizacao enviados pelo navegador.
- Homologar casos permitido/negado e acesso direto a API em HML antes de expandir aos outros modulos.
- Definir posteriormente os dados de teste e a conta de cada cenario. Esta proposta nao concede avcb.consultar a nenhuma conta.

A API atual de AVCB valida sessao e consulta mart_avcb com cliente privilegiado, sem aplicar requirePermission ou os escopos deste modelo. Portanto ainda falta implementar o piloto; a existencia do cadastro de permissoes nao protege por si essa consulta.

Os numeros sao fotografia de HML e podem mudar com o pipeline. O campo instalacao pode ser refinamento adicional; a proposta nao presume uma hierarquia organizacional universal entre todos os modulos.

Evidencia: evidencias/AVCB_INVENTARIO_ESCOPO_HML_20261030.json.
A conclusao da rodada administrativa esta em HOMOLOGACAO_GESTAO_20261030.md.
