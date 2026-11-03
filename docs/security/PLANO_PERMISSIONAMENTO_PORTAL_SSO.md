# Plano de permissionamento do Portal SSO / Celeo

> Atualização de 03/11/2026: a entrega foi delimitada ao acesso por abas, conforme decisão do usuário na conversa anterior. Integração e validação real registradas em [FECHAMENTO_PERMISSOES_ABAS_20261103.md](FECHAMENTO_PERMISSOES_ABAS_20261103.md). As pendências anteriores de matriz por unidade não integram esta versão.

Data: 29/10/2026.
Branch de trabalho: feat/portal-sso-permissoes-20261029.
Base: 73fbae339a7fe5643b973fa0e0c93cd5037f989b.
Estado atual reconciliado em 30/10/2026: tres migrations aplicadas somente em HML; cenarios administrativos registrados de consulta, perfil, concessao redundante temporaria, suspensao/reativacao, analise de solicitacoes ficticias, revogacao na sessao e concorrencia SQL/interface validados. Ultima suite: 78 testes, lint, tipos e build aprovados. Matriz concreta e isolamento das consultas operacionais pendentes. Ultima auditoria de dependencias: 15 alertas, sem criticos. Commits locais; sem push/PR/merge/PROD nesta frente. Relatorio atual: HOMOLOGACAO_GESTAO_20261030.md.

## 1. Decisao aprovada e limites

O usuario aprovou seguir com o modelo de perfil + modulo + acao + abrangencia dos dados. As concessoes concretas e os nomes dos perfis ainda nao foram definidos.

O trabalho se limita ao permissionamento do site nesta worktree. A implementacao deve respeitar a governanca canonica do Portal SSO. A pesquisa, o plano e a criacao da worktree nao comprovam teste em HML nem publicacao em PROD.

## 2. Publicos candidatos

O usuario sugeriu, como ideias e sem fixar nomenclatura, gestores de SSO, TSTs de SSO, gestores de outras areas, colaboradores de outras areas e terceiros.

Para discutir o desenho, adotamos as seguintes descricoes provisorias:

| Publico candidato | Necessidade a investigar | Abrangencia |
| --- | --- | --- |
| Gestao de SSO | Acompanhar indicadores e resultados de SSO | A definir |
| Equipe tecnica de SSO | Acompanhar atividades e dados de sua atuacao | A definir |
| Gestao das demais areas | Acompanhar indicadores relacionados a sua responsabilidade | A definir |
| Publico interno de consulta | Consultar informacoes pertinentes ao trabalho | A definir |
| Publico externo | Consultar conteudo expressamente autorizado | A definir |

Esses publicos nao sao perfis de acesso aprovados. Cargo, empresa, dominio de email ou publico nao devem ser usados isoladamente para conceder acesso. Administracao de usuarios e permissoes deve ser discutida como capacidade especifica; ser gestor de SSO nao implica administracao automatica do sistema.

## 3. Modelo a detalhar

- Perfil: conjunto reutilizavel de capacidades, separado do cargo da pessoa.
- Modulo: recurso do portal a que a capacidade se aplica.
- Acao: operacao permitida no recurso, conforme as funcionalidades existentes.
- Abrangencia: conjunto de registros autorizado para aquela capacidade e modulo.
- Estado: usuario ativo, suspenso ou ainda sem concessao.
- Vigencia: possibilidade a avaliar para acessos temporarios, especialmente externos.

Exemplo ilustrativo, sem concessao real: uma pessoa pode consultar AVCB de determinadas instalacoes e Motoristas de determinadas secoes. Essa autorizacao nao lhe concede gestao de usuarios nem acesso a outros modulos.

## 4. Fotografia do codigo desta base

- O login existente usa Supabase Auth.
- A migration de perfis_portal possui os papeis ADMIN_SSO e USUARIO e o campo ativo.
- frontend/src/lib/auth/requireAdmin.ts valida sessao, ADMIN_SSO e ativo nas APIs administrativas que o utilizam.
- As APIs consultadas de Inspecoes, AVCB e Planos de Acao validam autenticacao e consultam dados com cliente administrativo; nao implementam a matriz proposta.
- A aprovacao de solicitacao em api/gestao/solicitacoes-acesso/[id] atualiza o estado da solicitacao. Nao foi identificado nesse handler provisionamento de usuario nem atribuicao de permissoes.
- Existem links de menu para Usuarios e Permissoes; nao foram localizadas paginas implementadas para esses dois destinos nesta base.
- A API principal de Motoristas retorna varios conjuntos de dados, incluindo resumos e rankings. Restringir apenas as linhas das viagens seria insuficiente para proteger todo o resultado.

Esta leitura local nao confirma schema, usuarios, permissoes nem configuracao atualmente implantados no Supabase remoto.

## 5. Catalogo preliminar de recursos

| Recurso | API existente | Observacao |
| --- | --- | --- |
| AVCB | /api/avcb | Projeto, subestacao e instalacao |
| Inspecoes | /api/inspecoes | Area organizacional, local e dados do colaborador |
| Planos de Acao | /api/planos-acao | Nivel organizacional e grupo SSO |
| Acoes Corretivas | /api/acoes-corretivas | Nivel organizacional e grupo SSO |
| Motoristas | /api/motoristas | Varios conjuntos, resumos e rankings |
| Historico de Motoristas | /api/motoristas/historico | Coligada e secao RM; preservar gates operacionais |
| Direcao | /api/motoristas/direcao | Coligada e secao RM; preservar gates operacionais |
| Velocidade | /api/motoristas/velocidade | Preservar gates e isolamentos especificos |
| Solicitacoes de acesso | /api/gestao/solicitacoes-acesso | Gestao administrativa existente |
| Usuarios e Permissoes | A implementar, se aprovadas | Links existentes no menu |

Visao Geral, Extintores, Ensaios, Outros Indicadores, Programas de SSO e Configuracoes aparecem no menu. A presenca de link nao comprova funcionalidade implementada nem autoriza acesso. A cobertura efetiva sera delimitada antes da implementacao.

Nao existe evidencia de uma chave organizacional universal entre os modulos. O mapeamento entre unidades de negocio, coligadas, secoes, locais, instalacoes e grupos SSO precisa de validacao antes de filtrar registros.

## 6. Regras de seguranca propostas para validacao

1. Negar acesso quando nao houver concessao valida; usuario autenticado pode continuar sem acesso ao conteudo.
2. Validar perfil ativo, capacidade, modulo e abrangencia em cada requisicao protegida.
3. Tratar filtros escolhidos na tela como refinamento dos registros ja autorizados, nunca como fonte de autorizacao.
4. Preservar a associacao entre atributos: coligada e secao devem formar combinacoes autorizadas, evitando combinar listas independentes e ampliar acesso.
5. Representar explicitamente acesso corporativo; abrangencia vazia nao significa todos os registros.
6. Aplicar o mesmo limite a detalhes, totais, rankings, buscas e opcoes de filtro. Definir se agregados serao recalculados no escopo ou bloqueados quando nao puderem ser delimitados.
7. Usar a identidade validada da sessao e dados de autorizacao administrados pelo servidor. Nao aceitar papeis ou abrangencias enviados livremente pelo navegador.
8. Manter chaves administrativas somente no servidor. Escolher a estrategia de consultas e RLS de modo que uma chave privilegiada nao torne a politica inoperante.
9. Planejar revogacao para requisicoes futuras sem depender apenas de permissoes antigas armazenadas no token; dados ja entregues ao usuario nao podem ser recolhidos.
10. Registrar concessoes, alteracoes e revogacoes com autor, alvo, momento e resultado.
11. Proteger a continuidade administrativa, inclusive a desativacao do ultimo administrador ativo, antes de disponibilizar gestao de usuarios.
12. Permissao de usuario nao libera recursos operacionais bloqueados; os gates especificos de Motoristas permanecem independentes.

## 7. Decisoes ainda abertas

- Quais modulos e informacoes cada publico precisa consultar?
- Quem necessita de visao corporativa e quem necessita de unidades especificas?
- Qual unidade organizacional de negocio representa a abrangencia em cada modulo?
- Existem operacoes de negocio editaveis no portal ou a primeira versao sera de consulta e gestao de acessos?
- Quem podera conceder, revisar e revogar acessos? Existe delegacao limitada por unidade?
- Como serao criadas as contas e como a aprovacao de solicitacoes se relacionara com o provisionamento?
- Quais condicoes e prazos serao exigidos para terceiros?
- Como tratar usuarios existentes na implantacao sem liberar acessos por suposicao nem bloquear a administracao?
- Qual sera a estrategia de autorizacao no banco e nas APIs, considerando views e consultas administrativas existentes?

## 8. Sequencia de trabalho

1. Definir casos concretos de acesso e matriz de capacidades/abrangencias.
2. Conferir por leitura o schema relevante de HML e preparar proposta de mudancas restrita ao permissionamento.
3. Implementar componentes comuns e interfaces na branch exclusiva, conforme aprovacao do escopo concreto.
4. Validar testes de acesso permitido e negado, usuario inativo/sem perfil, acesso direto a APIs, alteracao de filtros e isolamento de agregados.
5. Homologar com contas e dados de HML, incluindo continuidade do administrador e revogacao.
6. Revisar diff, apresentar PR e plano de implantacao/rollback. Producao exige autorizacao especifica.

## 9. Fontes consultadas

- Governanca canonica v1.0 e instrucoes do projeto, lidas dos arquivos disponibilizados em Downloads. Permanecem como referencia; este plano nao as substitui.
- Diagnostico Markdown de 27/10/2026: evidencia historica, nao estado atual de producao.
- OWASP Authorization Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html
- NIST SP 800-162: https://csrc.nist.gov/pubs/sp/800/162/upd2/final
- Supabase RBAC: https://supabase.com/docs/guides/api/custom-claims-and-role-based-access-control-rbac
- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase API keys: https://supabase.com/docs/guides/getting-started/api-keys

## 10. Encaminhamento aceito em 29/10/2026

O usuario aprovou seguir com a proposta de publicos apresentada, mantendo nomes ajustaveis. Como ponto de partida, a gestao de SSO tem visao corporativa dos modulos autorizados; a equipe tecnica tem acesso as unidades atribuidas; gestores das demais areas consultam seu ambito de responsabilidade; publico interno e externo recebem acessos selecionados. Administracao de acessos e uma capacidade separada.

Essa aprovacao orienta o desenho: nao atribui acesso a nenhuma conta, nao substitui a matriz de capacidades por modulo e nao significa que todo integrante de um publico recebera automaticamente a mesma permissao. Titulos e vinculos organizacionais concretos permanecem pendentes.

## 11. Primeira base local

- frontend/src/lib/auth/politicaAcesso.ts: catalogo de recursos e acoes; validacao do contexto; resolucao de abrangencia; verificacao de acesso a registros; usuario/perfil ativo e vigencia UTC.
- frontend/tests/politicaAcesso.test.mjs: cenarios com unidades e usuarios ficticios, sem rede ou banco.
- frontend/tests/README.md: execucao, contratos e limites de integracao.
- frontend/package.json: comando test:permissoes; dependencias preservadas.

A base exige concessoes explicitas e preserva as combinacoes de atributos organizacionais. Nao interpreta abrangencia vazia como corporativa e nao atribui poderes pelo nome do perfil. As rotas existentes e requireAdmin.ts ainda nao foram alterados.

A validacao desta entrega cobre somente a biblioteca local. O aceite completo exige carregamento confiavel das concessoes, tratamento de agregados, interfaces administrativas, controles de banco e testes de integracao em HML.

## 12. Impacto e reversao

A alteracao e restrita a esta worktree, nos novos arquivos listados e no script de testes. Nao aplica schema, provisiona usuarios, concede acesso, modifica ETL nem publica dados. Como a biblioteca nao esta ligada as rotas, nao modifica o acesso atual do portal.

Para reverter esta entrega, remover somente os novos arquivos de politica, testes e plano e desfazer somente a adicao do script test:permissoes. Preservar demais mudancas e todas as outras worktrees.

## 13. Pacote local preparado apos leitura de HML

O usuario autorizou preparar exclusivamente o pacote local proposto, sem aplicar SQL em homologacao ou producao. Foram criadas as migrations 20261029151750_preparar_gestao_acesso_portal.sql e 20261029151752_criar_permissionamento_portal.sql pelo CLI, o carregador de contexto e o helper requirePermission, com testes integrados em PostgreSQL descartavel.

Resultado: 40 testes locais aprovados; verificacao estrita de tipos e contrato do cliente Supabase sem diagnosticos. O teste SQL usa PostgreSQL 18.6 em memoria; HML usa PostgreSQL 17. A homologacao permanece pendente.

A dependencia de desenvolvimento PGlite 0.5.13 foi adicionada na raiz, com versao fixada no lockfile; as dependencias de execucao do frontend foram preservadas. Os scripts de teste e a opcao allowImportingTsExtensions foram atualizados para os novos testes.

O manifesto, os limites, as evidencias da leitura anterior e o roteiro de homologacao estao em PACOTE_LOCAL_PERMISSIONAMENTO.md, neste mesmo diretorio. Este registro complementa as secoes 11 e 12: o pacote agora inclui arquivos SQL locais e helpers, mas continua sem integrar rotas ou modificar bancos externos. A primeira administracao e as concessoes reais exigem revisao e autorizacao especificas.

## 14. Homologacao iniciada e teste de conta sem acesso

As duas migrations foram aplicadas em HML apos autorizacao do usuario; a primeira administracao de teste foi atribuida a conta expressamente escolhida. O usuario criou uma segunda conta, seguranca@celeogroup.com, com senha propria. Seu login foi confirmado no Supabase e o usuario informou que todas as verificacoes da tela local passaram, incluindo bloqueios esperados no novo modelo. Nenhuma concessao foi atribuida a segunda conta.

O relatorio HOMOLOGACAO_PERMISSIONAMENTO_20261029.md e as evidencias PRE/POS em evidencias registram versoes remotas, testes, limites e pendencias. As secoes 11 a 13 representam as entregas anteriores; a declaracao de ausencia de SQL remoto nesses trechos e historica. A integracao das rotas, protecao dos dados e homologacao completa continuam pendentes.

## 15. Segunda conta com gestao temporaria aprovada

Apos o teste inicial aprovado, o usuario autorizou tres capacidades de gestao por 24 horas para seguranca@celeogroup.com em HML. A concessao foi aplicada com identidade base USUARIO, sem promover ADMIN_SSO legado nem conceder consulta aos paineis. Vigencia: 29/10/2026 15h43 ate 30/10/2026 15h43 de Brasilia (fim exclusivo, milissegundos no relatorio). O contexto e os limites foram verificados; login real do cenario administrativo confirmado posteriormente. Detalhes e evidencia em HOMOLOGACAO_PERMISSIONAMENTO_20261029.md e evidencias/HML_GESTAO_TEMPORARIA_20261029.json.

## 16. Validacao administrativa confirmada

O usuario confirmou todas as verificacoes da tela administrativa. Novo login confirmado no Supabase em 29/10/2026 15h46 de Brasilia. Permanecem exatamente tres abrangencias de gestao, zero consultas concedidas e o vencimento original. Ultima suite local: 44 testes aprovados. Proxima proposta: testar suspensao e reativacao da atribuicao na mesma sessao, sem estender o prazo. Nenhuma suspensao foi executada.

## 17. Revogacao e reativacao na mesma sessao aprovadas

O usuario confirmou bloqueio depois da suspensao e reativacao depois do restabelecimento, sem novo login. O Supabase confirmou ultimo login preservado, duas alteracoes auditadas no segundo ciclo, identidade USUARIO ativa, tres abrangencias, zero consultas concedidas e vencimento original. A primeira tentativa foi inconclusiva por painel oculto; foi encerrada com reativacao, corrigida e repetida. Resultado atual: atribuicao ativa; 50 testes locais aprovados. Integracao das rotas e isolamento dos dados operacionais permanecem pendentes. Detalhes no relatorio de homologacao e nas evidencias de revogacao.

## 18. Integracao local da gestao preparada

O usuario autorizou preparar a integracao na worktree. Foram conectadas as tres areas de gestao, a RPC privada auditada, versoes contra edicao antiga, protecao transacional do ultimo administrador permanente e verificacoes de origem/corpo das APIs. A terceira migration foi gerada pelo CLI e testada somente em PostgreSQL descartavel; nenhuma escrita remota foi feita nesta etapa. Resultado: 74 testes, tipos, lint e build aprovados. Interfaces reais e concorrencia PostgreSQL 17 continuam pendentes. A versao Next.js 16.1.6 existente apresentou alerta critico; a proposta pontual de atualizacao esta registrada e ainda nao foi executada. Detalhes em INTEGRACAO_GESTAO_ACESSOS_LOCAL_20261029.md.

## 19. Atualizacao de dependencias autorizada e concluida em 30/10/2026

Next.js/eslint-config-next 16.4.1 e PostCSS 8.5.23 foram fixados e instalados somente na worktree de permissoes, com copia pontual dos manifests/lockfile anteriores. Os demais pacotes diretos foram preservados. A compatibilidade do lint exigiu adequar somente o carregamento da tela de solicitacoes ao hook da integracao; as contagens do servidor foram verificadas por novo teste. Resultado: 75 testes, tipos, lint e build aprovados. Auditoria: zero criticos; 15 registros restantes, descritos na evidencia DEPENDENCIAS_FRONTEND_20261030.json. A terceira migration continua somente local; sem escrita remota, commit ou deploy nesta etapa.

## 20. Conferencia entre plano e entrega — 30/10/2026

O usuario solicitou confirmar o fechamento sem suposicoes. Foram comparados este plano, PACOTE_LOCAL_PERMISSIONAMENTO.md, HOMOLOGACAO_GESTAO_20261030.md, evidencias da concorrencia, historico Git e as oito rotas operacionais. Conclusao: o permissionamento completo ainda nao esta encerrado.

| Item planejado | Evidencia e estado |
| --- | --- |
| Modelo perfil/modulo/acao/abrangencia, vigencia e contexto proprio | Implementado e testado na base HML; nomes e concessoes de negocio ainda nao definidos |
| Banco, auditoria e protecao do ultimo administrador | Aplicados em HML e testados nos cenarios documentados |
| Interfaces de gestao | Tres telas consultadas; criar, editar descricao e desativar perfil vazio validados com autoria |
| Revogacao/reativacao e concorrencia | Sessao sem novo login validada; disputa SQL/interface com versao antiga comprovada em dois PIDs. Nao equivale a todos os casos concorrentes |
| Concessoes e analise de solicitacoes | Cenarios autorizados pela interface validados: concessao redundante temporaria, edicao de vigencia, suspensao/reativacao e analise de duas solicitacoes ficticias, com autoria e sem provisionamento automatico |
| Matriz concreta de acesso por publico, modulo e unidade | Pendente; publicos provisorios nao sao concessoes aprovadas |
| Isolamento de consultas, detalhes, totais, filtros e rankings | Pendente. As oito APIs operacionais ainda nao usam requirePermission/abrangencia do novo modelo |
| Revisao final, PR e implantacao/recuperacao | Fechamento pendente; nenhuma liberacao de producao. Classificar tambem os 15 alertas da ultima auditoria de dependencias |

Proposta de sequencia, ainda sem nova execucao: concluir os testes administrativos de concessao e analise pela interface com dados de teste; definir casos concretos da matriz; integrar e homologar um modulo piloto, propondo AVCB; expandir aos demais modulos; realizar revisao final e apresentar PR e plano de implantacao/recuperacao conforme governanca.

As secoes anteriores registram fases historicas. O cabecalho e esta secao reconciliam o estado atual sem transformar testes parciais em aceite completo. A contagem historica de 23/26 etapas do portal nao foi reavaliada por esta conferência do permissionamento.

## 21. Rodada administrativa validada — 30/10/2026

Concessao temporaria redundante criada, vigencia editada e estados alternados pela interface. Estado final suspenso; perfil inativo e zero capacidades ativas. Duas solicitacoes ficticias analisadas (aprovacao e rejeicao), filtros e autoria conferidos. Duas contas Auth preservadas; tres atribuicoes (duas originais intactas e teste suspenso). Auditorias 22 -> 38, com 16 eventos da conta de teste. Ver HOMOLOGACAO_GESTAO_20261030.md e evidencias/FLUXOS_ADMINISTRATIVOS_GESTAO_20261030.json para alcance, limites e consulta dos eventos.

Continuam pendentes matriz real de negocio, integracao das oito APIs operacionais, homologacao do isolamento, revisao final e plano de implantacao/recuperacao. A proxima proposta sera o piloto AVCB. A cobertura administrativa e dos cenarios registrados, nao de todo o portal.

## 22. Proposta do piloto AVCB baseada em leitura — 30/10/2026

HML: 63 registros, 16 projetos, 60 nomes de subestacao; tres nomes aparecem em mais de um projeto. instalacao contem somente Acessante/Propria e nao identifica sozinho uma unidade. Proposta em PROPOSTA_PILOTO_AVCB_20261030.md: capacidade avcb.consultar com abrangencia explicita corporativa, por projetos ou por pares projeto/subestacao; classificacao de instalacao como refinamento adicional. Padrao de abrangencia e atribuicoes reais aguardam decisao do usuario. Nenhuma mudanca de codigo, schema ou concessao nesta leitura. Evidencia em AVCB_INVENTARIO_ESCOPO_HML_20261030.json.
