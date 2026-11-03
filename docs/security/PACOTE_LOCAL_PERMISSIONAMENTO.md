# Pacote local de permissionamento — para revisao

> Atualização de 03/11/2026: a entrega foi delimitada ao acesso por abas, conforme decisão do usuário na conversa anterior. Integração e validação real registradas em [FECHAMENTO_PERMISSOES_ABAS_20261103.md](FECHAMENTO_PERMISSOES_ABAS_20261103.md). As pendências anteriores de matriz por unidade não integram esta versão.

Data de referencia: 29/10/2026.
Worktree: pipelinesso-permissoes.
Branch: feat/portal-sso-permissoes-20261029.
Base: 73fbae339a7fe5643b973fa0e0c93cd5037f989b.
Estado atual reconciliado em 30/10/2026: tres migrations em HML e cenarios administrativos autorizados validados, incluindo concessao temporaria redundante e analise de solicitacoes ficticias pela interface. Ultima suite: 78 testes. Matriz concreta e isolamento das consultas operacionais pendentes. Commits locais; sem push/PR/merge/PROD nesta frente. Ultima auditoria de dependencias: zero criticos e 15 alertas.

> Estado atual e limites: HOMOLOGACAO_GESTAO_20261030.md e secao 20 de PLANO_PERMISSIONAMENTO_PORTAL_SSO.md.

> As secoes abaixo preservam o pacote preparado antes da autorizacao de HML e devem ser lidas como historico. A base inicial esta em HOMOLOGACAO_PERMISSIONAMENTO_20261029.md; a gestao e o estado mais recente estao em HOMOLOGACAO_GESTAO_20261030.md.

## 1. Escopo autorizado

Preparar localmente as migrations, o carregamento das concessoes, a verificacao comum de acesso, os testes e a documentacao. O usuario reservou a aplicacao no Supabase e a integracao ao site para revisao e autorizacao posteriores.

As rotas atuais, requireAdmin.ts, o BAT, os scripts ETL, os marts, as views operacionais e os gates de Velocidade permanecem fora das alteracoes deste pacote.

## 2. Evidencias da leitura de HML

Projeto consultado: pipelinesso-homologacao / ckfsarzmudwdehiiltwi. Somente SELECT de estrutura, privilegios, migrations e contagem agregada de contas. Nao foram coletados emails, senhas ou tokens.

Na fotografia de 29/10/2026:

- public.perfis_portal e public.solicitacoes_acesso nao existiam.
- Havia uma conta em auth.users com email confirmado; nao foi escolhida como administradora.
- As tabelas de dados analisadas tinham RLS habilitada, sem politicas para os usuarios do portal.
- As tabelas/views de Planos de Acao usadas pelo site nao estavam presentes.
- mart_avcb estava presente, mas service_role nao possuia SELECT efetivo naquele instante. Esta pendencia pertence a preparacao do modulo; nao foi corrigida aqui.
- Resumos e pendencias de Motoristas nem sempre possuem coligada e secao; nao podem ser liberados a um usuario restrito sem tratamento proprio.
- vw_motoristas_direcao_4h estava configurada com security_invoker=true. vw_portal_acoes_corretivas nao tinha essa opcao. Nenhuma view foi alterada.

Esses pontos nao comprovam o estado da producao nem substituem a reconferencia antes de uma futura aplicacao, pois outra frente trabalha no ambiente.

## 3. Arquivos e contratos

| Arquivo | Finalidade |
| --- | --- |
| supabase/migrations/20261029161856_preparar_gestao_acesso_portal.sql | Base de perfis e solicitacoes, compativel com os handlers existentes, sem bootstrap por email |
| supabase/migrations/20261029162052_criar_permissionamento_portal.sql | Perfis de acesso, permissoes, atribuicoes, abrangencias, auditoria e consulta do contexto proprio |
| frontend/src/lib/auth/politicaAcesso.ts | Regras de acesso da primeira entrega; exporta tambem o validador de contexto |
| frontend/src/lib/auth/carregarContextoAcesso.ts | Valida identidade com getUser e carrega a RPC sem receber user_id da tela |
| frontend/src/lib/auth/requirePermission.ts | Combina contexto, vigencia, modulo, acao e gate informado pelo servidor; retorna a abrangencia obrigatoria da futura consulta |
| frontend/tests/contextoAcesso.test.mjs | Falhas de sessao, transporte, payload, identidade divergente e revogacao |
| frontend/tests/permissionamentoBanco.test.mjs | SQL, privilegios e carregamento integrados em PostgreSQL descartavel |
| frontend/tests/clienteSupabase.typecheck.ts | Compatibilidade do adapter com SupabaseClient |
| frontend/tests/politicaAcesso.test.mjs | Cenarios de acesso por unidade, datas, perfil e modulo da primeira entrega |
| package.json / package-lock.json | Dependencia de desenvolvimento PGlite 0.5.13 fixada e comando de testes |
| frontend/package.json | Executa todos os testes de permissoes |
| frontend/tsconfig.json | Permite imports explicitos .ts para os testes nativos, mantendo noEmit e strict |

## 4. Estrutura preparada

A primeira migration prepara somente public.perfis_portal e public.solicitacoes_acesso. Preserva as linhas existentes, nao insere ADMIN_SSO e explicita SELECT/INSERT/UPDATE de service_role nessas duas tabelas. Os clientes anonimos e autenticados nao recebem acesso direto a elas.

A segunda cria um schema exclusivo portal_acesso. Se o schema ja existir, a migration falha e sua transacao deve ser revertida, em vez de conciliar ou revogar privilegios de objetos desconhecidos.

| Tabela interna | Conteudo |
| --- | --- |
| perfis | Codigo, nome, descricao e estado do perfil de acesso |
| permissoes_perfil | Modulo, acao e estado de cada capacidade do perfil |
| atribuicoes | Pessoa, perfil, estado e vigencia |
| abrangencias | Concessao corporativa ou combinacoes de campos nativos por atribuicao/modulo/acao |
| auditoria | Antes/depois das alteracoes, momento, transacao e autoria/sessao disponivel |

As chaves compostas impedem atribuir uma abrangencia a capacidade ou perfil diferente daquele concedido. As restricoes SQL rejeitam combinacoes invalidas, listas restritas vazias e secao RM sem coligada.

Nao sao criados perfis padrao nem atribuicoes para contas existentes. Cargo, nome do perfil e ADMIN_SSO legado nao concedem implicitamente acesso aos dados pelo novo modelo.

## 5. Consulta e fronteiras de seguranca

O fluxo preparado e:

1. O servidor valida a identidade com o cliente Supabase da sessao, usando getUser.
2. Esse mesmo cliente chama public.obter_contexto_acesso_portal(), sem parametros.
3. O wrapper public e SECURITY INVOKER. Ele chama a funcao interna portal_acesso.obter_contexto_proprio(), que exige auth.uid() e consulta exclusivamente aquela identidade.
4. A resposta e validada contra o contrato TypeScript e o usuario autenticado. Falha de banco, payload ou identidade produz indisponibilidade, nunca uma concessao ampla.
5. requirePermission retorna negacao ou abrangencia para aplicar posteriormente a consulta do modulo.

As tabelas internas possuem RLS e nenhum grant direto a anon, authenticated ou service_role. authenticated recebe somente USAGE do schema e EXECUTE da consulta propria. Na futura HML, confirmar que portal_acesso nao esta entre os schemas expostos pela Data API. Nao existe alteracao de configuracao da API neste pacote.

SECURITY DEFINER e restrito a duas funcoes internas: leitura do contexto proprio, indispensavel para mediar as tabelas privadas e limitada por auth.uid(), e gravacao de auditoria por trigger, sem EXECUTE direto para clientes. Ambas possuem search_path vazio e referencias de tabelas qualificadas. Nao existe funcao SECURITY DEFINER nova em public.

A auditoria ocorre na mesma transacao da alteracao. Com JWT, registra auth.uid(). Manutencao SQL sem identidade autenticada registra a sessao do banco e autor_id nulo, sem atribuir a acao a uma pessoa por suposicao. A identidade publica e as quatro tabelas de configuracao sao auditadas; solicitacoes com dados pessoais nao sao copiadas para essa auditoria generica.

O pacote NAO cria politicas de leitura dos marts. Obter uma abrangencia valida nao autoriza consultar dados irrestritos. O carregamento nao usa chave administrativa e nao armazena permissoes em cache.

## 6. Validacao na preparacao local inicial (historico)

- 40 testes passaram pelo runner nativo do Node 24.22.0.
- SQL executado exclusivamente em PGlite 0.5.13, PostgreSQL 18.6, sem caminho persistente: banco somente em memoria.
- As fixtures simulam auth.users, auth.uid() e os papeis anon/authenticated/service_role; nao simulam login HTTP, cookies, PostgREST, infraestrutura Supabase ou avisos de seguranca do projeto real.
- Foram testados criacao sem grants automaticos, preservacao de identidade existente, isolamento por usuario, privilegios efetivos, vigencia UTC, revogacao, chaves/constraints e auditoria transacional.
- Um objeto operacional ficticio manteve seus privilegios e RLS durante as duas migrations.
- Verificacao estrita de tipos e compatibilidade com a biblioteca Supabase usada pelo site: zero diagnosticos.

HML utiliza PostgreSQL 17. Portanto o resultado local nao equivale a aprovacao do SQL em HML. Nenhum teste foi executado no Supabase remoto nesta entrega.

## 7. Roteiro apresentado antes da autorizacao de HML (historico)

1. Reconferir alvo ckfsarzmudwdehiiltwi, dependencias presentes, ausencia do schema portal_acesso, privilegios atuais das duas tabelas base e versao do banco.
2. Revisar e aprovar explicitamente apenas as duas migrations deste pacote, com plano de recuperacao e inventario anterior. Nao usar db push, migration up ou reset para executar o historico inteiro: ha migrations de outros escopos e bootstrap legado por email.
3. Escolher explicitamente a identidade de administrador/teste de HML e definir o bootstrap como operacao separada. Nao reutilizar contas ou segredos de producao.
4. Aplicar as migrations aprovadas e confirmar por leitura estrutura, grants, RLS, assinaturas/privilegios de funcoes e ausencia de alteracao operacional. Rodar os advisors do projeto e tratar somente achados pertinentes.
5. Criar concessoes ficticias autorizadas e testar RPC com sessoes distintas reais, ausencia de sessao, usuario inativo, revogacao, vigencia e tentativa de troca de identidade.
6. Somente depois preparar interfaces administrativas e integrar um modulo piloto. Antes de permitir mutacoes por essas interfaces, implementar autorizacao de cada operacao, protecao do ultimo administrador ativo e auditoria com identidade verificada.
7. Proteger consultas, agregados, rankings e filtros no banco e no servidor antes de anunciar permissionamento completo. Tratar as views e os dados sem unidade identificada explicitamente.

## 8. Recuperacao e limites na entrega local inicial (historico)

Agora a recuperacao e apenas local: desfazer os trechos desta entrega e remover seus novos arquivos, preservando as demais mudancas da worktree. Nao usar reset/clean/stash nem apagar historicos.

Depois de uma futura aplicacao remota, nao executar DROP em cascata nem um script de rollback generico. A primeira migration pode encontrar e preservar tabelas preexistentes; recupera-las exige o inventario anterior de estrutura/grants e a preservacao das linhas. O schema novo pode passar a conter concessoes e auditoria, que devem ser preservadas antes de qualquer reversao aprovada.

A escolha do primeiro administrador, as interfaces, a protecao do ultimo administrador, o isolamento dos dados operacionais, a homologacao e a producao continuam pendentes. Esta entrega nao modifica os acessos atuais do site.
