# Homologacao do permissionamento — 29/10/2026

Estado: homologacao parcial. O novo modelo ainda nao esta integrado as rotas ou aos paineis do portal. ESTADO ATUAL: segundo ciclo de revogacao concluido. O usuario confirmou bloqueio e reativacao na mesma sessao. A atribuicao esta ativa, com prazo original e zero concessoes de consulta. A primeira tentativa inconclusiva e o erro de tela permanecem registrados como historico.

## Autorizacao e ambiente

O usuario aprovou a aplicacao das duas migrations revisadas e os testes em pipelinesso-homologacao (ckfsarzmudwdehiiltwi), PostgreSQL 17.11. Escolheu expressamente vinicius.brum@celeogroup.com para a primeira administracao de teste. Nenhuma acao desta frente foi aplicada em producao, BAT ou ETL.

## SQL aplicado e correspondencia de arquivos

| Versao local inicial | Versao registrada em HML | Nome |
| --- | --- | --- |
| 20261029151750 | 20261029161856 | preparar_gestao_acesso_portal |
| 20261029151752 | 20261029162052 | criar_permissionamento_portal |

O conector atribuiu as versoes remotas na aplicacao. Os dois arquivos locais foram renomeados para corresponder ao historico remoto, com verificacao SHA-256 de conteudo identico. Nenhum SQL foi reaplicado ou alterado nessa reconciliacao. Os testes selecionam as migrations pelo sufixo e exigem correspondencia unica.

## Primeira administracao

O bootstrap separado criou uma identidade ativa ADMIN_SSO para a conta aprovada e atribuiu o perfil administracao_acessos_hml com somente usuarios.gerenciar, permissoes.gerenciar e solicitacoes_acesso.gerenciar. Ha tres abrangencias corporativas de gestao e zero concessoes de consulta aos dados no novo modelo.

A identidade ADMIN_SSO pertence tambem ao modelo legado. A ausencia de concessoes de dados no novo modelo nao comprova limitacao das rotas antigas; requireAdmin e as rotas atuais nao foram alterados. A autoria do bootstrap privilegiado permanece registrada como sessao SQL, sem simular uma identidade humana.

Apos o bootstrap: um perfil configurado, uma atribuicao, tres capacidades/abrangencias e nove eventos de auditoria.

## Verificacoes remotas

Dez grupos SQL passaram no PostgreSQL 17 da HML: identidade propria, isolamento de tabelas privadas, ausencia de identidade, identidade sem cadastro, abrangencia e datas UTC, constraints/chaves, revogacao, estado de perfil/atribuicao, estado da pessoa e auditoria.

Os testes SQL usam contexto de papeis/JWT simulado em transacao e ROLLBACK. A fixture e sua auditoria nao persistiram. Esses testes nao substituem login HTTP real ou teste dos paineis.

As 33 relacoes operacionais do inventario anterior e as sete rotinas anteriores conservaram seus metadados comparados. Uma nova sobrecarga de promover_pipeline_sso foi observada em migration de outra frente (20261029162337); nao foi aplicada por este chat. O inventario nao e uma comparacao do conteudo de todas as linhas operacionais.

Os advisors conservaram os dois avisos preexistentes: search_path de definir_situacao_gerencial_planos_acao e protecao de senhas vazadas desabilitada. Os informativos de RLS sem politica passaram de 30 para 37: as sete tabelas novas bloqueiam acesso direto deliberadamente. Nao foram alteradas configuracoes gerais de seguranca.

## Login e segunda conta

O usuario informou nao conhecer a senha da primeira conta. A conta ja existia com senha e email confirmado; esta frente nao definiu nem recebeu sua senha. A recuperacao foi preparada pelo SDK publico. Registros mostraram cota de email atingida (429 over_email_send_rate_limit), e um link recebido era de entrada magiclink, rejeitado pela recuperacao que exige recovery.

O usuario preferiu criar seguranca@celeogroup.com no Supabase com senha propria. A conta foi conferida ativa, confirmada e com senha, sem ler senha/hash ou tokens. No primeiro teste, nao possuia linha em perfis_portal nem atribuicoes; a concessao posterior esta registrada abaixo.

O ultimo login dessa segunda conta foi confirmado em auth.users em 2026-10-29T18:15:34.67238Z (15h15 de Brasilia). O usuario confirmou a mensagem final: “Validacao concluida: todas as verificacoes passaram.” O controle da aba estava indisponivel; o resultado visual completo foi confirmado pelo usuario, nao inspecionado automaticamente.

Cenario da tela: login/getUser real; ausencia de identidade ativa no portal; gestao e consulta a Motoristas negadas; RPC sem login bloqueada; leitura direta de perfis_portal bloqueada; schema privado fora da API. O bloqueio inicial ocorre pela ausencia de cadastro ativo; isso ainda nao testa todos os casos de uma pessoa ativa com perfil granular.

## Tela e tratamento de credenciais

A ferramenta tools/permissionamento-hml e exclusivamente local, ligada a 127.0.0.1, e usa chave publica de HML. Configuracao e regras compiladas ficam na cache ignorada. O SDK e lido da dependencia ja instalada no checkout principal, sem altera-lo.

Senhas e tokens nao sao registrados ou persistidos pela ferramenta; sessao apenas em memoria. Nenhuma chave administrativa e enviada ao navegador. A opcao de redefinicao administrativa sem email foi proposta e recusada pelo usuario; nao foi implementada.

## Concessao temporaria autorizada e aplicada

O usuario aprovou explicitamente as tres permissoes por 24 horas para seguranca@celeogroup.com, somente em HML. O preflight reconfirmou conta ativa/confirmada, ausencia de cadastro previo e perfil com exatamente as tres capacidades autorizadas.

Foi criada uma identidade ativa com papel base USUARIO e uma atribuicao a administracao_acessos_hml, com tres abrangencias corporativas de gestao. A conta original e seu ADMIN_SSO foram preservados. Nenhuma consulta aos dados foi concedida. O papel base USUARIO nao promove a segunda conta ao administrador das rotas legadas.

Inicio: 29/10/2026 as 15h43m20,625s de Brasilia (2026-10-29T18:43:20.625Z).
Fim exclusivo: 30/10/2026 as 15h43m20,625s de Brasilia (2026-10-30T18:43:20.625Z).

A operacao pontual esta em supabase/reviews/permissionamento/conceder_gestao_temporaria_hml_20261029.sql. Interrompe se a conta ja estiver configurada, sem repetir ou sobrescrever concessoes. Gerou cinco eventos de auditoria na mesma transacao; a sessao SQL e registrada sem atribuir autoria JWT por suposicao.

A RPC retornou somente as tres capacidades e a vigencia exata sob papel/identidade simulados, em transacao revertida. O helper local foi conferido com esse contexto: doze verificacoes nos limites de inicio/fim das tres capacidades e oito modulos de consulta negados. A expiracao e aplicada pelo helper; a RPC permanece fornecendo a atribuicao e suas datas depois do vencimento. A integracao das rotas continua necessaria.

A tela local passou ao cenario administrativo e verifica tambem o vencimento usando o helper, sem alterar o relogio ou o banco. O usuario confirmou que todas as verificacoes passaram nesse cenario. O Supabase confirmou novo login em 29/10/2026 as 15h46m38s de Brasilia (2026-10-29T18:46:38.302239Z), com tres abrangencias de gestao, zero concessoes de consulta e prazo original preservado. O resultado visual foi confirmado pelo usuario, pois o controle da aba estava indisponivel.

## Pendencias

Os testes de login sem acesso e de gestao temporaria com login real foram aprovados pelo usuario. A expiracao foi verificada pelo helper com relogio de teste; nao foi necessario aguardar as 24 horas. Abrangencia entre pessoas reais, isolamento dos dados, protecao do ultimo administrador, interfaces e integracao do modulo piloto continuam pendentes. A revogacao com sessao real foi concluida no segundo ciclo registrado adiante.

O teste de suspensao e reativacao proposto foi autorizado e concluido no segundo ciclo descrito adiante, com o prazo original preservado.

Nao houve commit, push, PR, deploy ou homologacao completa do portal.

## Primeira tentativa de revogacao — registro historico

O usuario autorizou suspender, verificar bloqueio sem logout e reativar a mesma atribuicao sem estender o prazo. A tela foi atualizada e o usuario confirmou novo login aprovado e os dois botoes visiveis. Baseline no Supabase: login em 29/10/2026 16h04m55s de Brasilia, 14 auditorias e um ADMIN_SSO legado ativo.

A suspensao foi executada: apenas atribuicao.ativo passou a false. A identidade continua ativa, com papel USUARIO, tres abrangencias e zero consultas concedidas; inicio e vencimento originais preservados. O usuario pediu orientacao sobre a localizacao do botao; foi orientado a usar a mesma aba, abaixo da lista e acima de Encerrar sessao. A confirmacao do resultado visual e a reativacao estao pendentes.

Executar a reativacao ja autorizada apos verificar o bloqueio, usando reativar_gestao_teste_hml_20261029.sql e mantendo o vencimento original. Conferir ultimo login contra o baseline para detectar troca de sessao; o modulo local tambem compara o token em memoria, sem registra-lo ou retorna-lo. Se houver novo login, registrar o limite e repetir o ciclo com uma sessao inicial valida. Suite local atual: 49 testes aprovados, incluindo cinco cenarios da revalidacao sem login. Nenhuma alteracao em PROD.

## Correcao da tela e encerramento da primeira tentativa

O usuario nao encontrou o botao. A inspecao do arquivo revelou que a insercao da referencia da sessao e da exibicao do painel apos o login nao ocorreu: a substituicao textual nao correspondeu ao arquivo com CRLF e falhou silenciosamente. O teste anterior cobria a regra de revalidacao, mas nao sua ligacao a tela. A confirmacao inicial de botoes visiveis nao foi considerada prova suficiente depois dessa descoberta.

A atribuicao foi reativada pela operacao ja autorizada. O banco confirmou ativo=true, inicio e fim originais, um ADMIN_SSO legado e 16 auditorias (duas a mais que o baseline). O ultimo login continuou igual ao baseline de 16h04m55s; o bloqueio real no navegador nao foi observado, portanto a primeira tentativa e inconclusiva. Nenhum acesso de consulta foi concedido.

A tela foi corrigida: painel visivel antes do formulario, botoes numerados, referencia em memoria ligada ao login, habilitacao somente apos validacao e retorno automatico ao painel. Um teste de integracao executa o codigo real da tela com DOM/SDK simulados e as regras reais, cobrindo exibicao, habilitacao, suspensao, reativacao sem outro login e logout. Os 50 testes locais passaram; isso nao substitui a repeticao em navegador.

Estado atual: conta reativada, prazo preservado, aguardando o usuario atualizar a pagina e entrar para confirmar os botoes antes de uma nova suspensao. A autorizacao original para concluir o ciclo permanece vigente. Nao executar nova suspensao antes dessa confirmacao.

## Segundo ciclo de revogacao — concluido

O usuario enviou inicialmente revisao no teste de bloqueio enquanto a concessao ainda estava ativa e confirmou a reativacao pelo botao 2. Isso validou os botoes corrigidos, mas nao foi contado como prova de revogacao.

O preflight reconfirmou login de 29/10/2026 16h16m08s de Brasilia (2026-10-29T19:16:08.120846Z), identidade USUARIO ativa, atribuicao ativa, tres abrangencias, prazo original, 16 auditorias e um ADMIN_SSO legado ativo.

A atribuicao foi suspensa em 29/10/2026 16h17m12s de Brasilia. O usuario confirmou: “Bloqueio confirmado: todas as verificacoes passaram, sem novo login.” A conta permaneceu autenticada e ativa; as tres gestoes foram negadas pelo novo modelo, preservando datas e negacao de consulta.

A mesma atribuicao foi reativada em 29/10/2026 16h20m24s. O usuario confirmou: “Reativacao confirmada: todas as verificacoes passaram, sem novo login.” A identidade e o prazo original foram preservados.

A leitura final de 16h22m11s confirmou ultimo login identico ao baseline, atribuicao ativa, inicio e fim identicos, tres abrangencias, zero consultas concedidas, um ADMIN_SSO legado e 18 auditorias. Os dois UPDATEs do ciclo foram conferidos por estado false/true e instante. O helper da tela compara tambem o token em memoria; nenhum token foi coletado ou persistido pelo agente. O resultado visual foi confirmado textualmente pelo usuario, pois o controle da aba estava indisponivel.

Resultado: teste de revogacao e reativacao aprovado na tela local com Supabase real. O fim permanece 30/10/2026 as 15h43m20,625s de Brasilia (2026-10-30T18:43:20.625Z). A aprovacao nao comprova integracao das rotas, isolamento dos dados operacionais nem protecao completa do portal. A expiracao e aplicada pelo helper, ainda sem integracao nas rotas do site.

Evidencias em evidencias/HML_REVOGACAO_20261029.json; primeira tentativa inconclusiva preservada separadamente. Suite local atual: 50 testes aprovados.

Nenhum commit, push, PR, deploy ou alteracao em producao foi realizado.
