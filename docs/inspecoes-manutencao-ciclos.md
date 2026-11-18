# Inspeção da Manutenção — painel aprovado em 17/11/2026

Destino: Painel Gerencial → Inspeções → **Inspeção da Manutenção**.
A aba Segurança (Prevsys), o layout administrativo e as permissões existentes devem permanecer preservados.

## Carga operacional e liberação de 18/11/2026

O usuário autorizou a exceção temporária de certificado na leitura SQL e a continuidade até produção. A conexão permanece criptografada, com intenção de somente leitura; a exceção não foi tornada padrão.

Foi extraído e validado o período de 01/10 a 01/12 exclusivo: 907 formulários, 114 OS e 444 atividades. Outubro contém 740 formulários; novembro, 167. A carga foi publicada e conciliada na homologação; setembro foi preservado. As cargas anteriores dos dois ambientes foram salvas localmente em `data/bronze`, fora do Git.

As posições atuais de instalações, extintores e frota foram calculadas com o cadastro SQL extraído no mesmo dia: respectivamente 59/57/2, 64/51/13 e 121/94/27 unidades de população/com registro/sem registro. O cadastro continua provisório quanto à elegibilidade. Presença de respostas é informada separadamente: 57, 50 e 94 unidades, respectivamente.

Ferramentas EAT/LT e carga 148/149 preservam as posições conferidas em 17/11 e sua data original. As demais categorias sem população definida mostram os registros da carga atual, sem inventar metas. Não reutilizar a população atual para meses históricos. Um filtro de coligada com vínculo desconhecido permanece sem valor confirmado.

Validação final: 170 testes do frontend, 28 do backend e compilação completa aprovados. Tela conferida com a carga real: veículos em páginas 10/10/7, extintores em 10/3; CRTE 20/10/10; outubro com registros, mas sem meta histórica inferida. A publicação usa a integração Git já existente do portal; a prévia automática do PR 28 foi confirmada como pronta.

### Repetição da carga

1. Usar `extrair_painel_manutencao.ps1` para extrair os meses completos necessários ao início dos ciclos.
2. Usar `extrair_populacoes_ciclos.ps1 -ArquivoBase <extracao.json> -ArquivoConfiguracao <configuracao-protegida> -DestinoJson <cadastros-novos.json>` para ler locais, frota e presença de respostas. O certificado é validado por padrão.
3. Usar `compor_ciclos_manutencao.py --base <extracao.json> --auxiliares <cadastros.json> --conferidas <posicoes-conferidas.json> --saida <arquivo-novo.json>`. Recortes do BI exigem posições conferidas do mês correspondente, sem alteração artificial da data.
4. Preparar as cargas com `painel_manutencao.py`; salvar a publicação anterior, publicar em homologação e conciliar antes de produção. Não versionar os arquivos de dados ou de configuração.

## Decisões aprovadas

- Linguagem do painel: “Meta aguardando confirmação” substitui “População provisória”; “Meta confirmada” e “Meta ainda não definida” distinguem os demais estados. A tela usa locais, veículos, pessoas ou itens conforme o tipo de inspeção, explica a confirmação da lista pelos responsáveis e preserva a distinção entre registro e conclusão. Seleção, período e dados até substituem recorte, ciclo e data de corte nos textos de uso diário. Códigos internos de ficha/aba ficam fora da apresentação; cálculos, filtros e dados publicados não mudam.
- Respeitar marca, fonte, cores, cabeçalho e menu do portal existente.
- Exibir no máximo dez unidades na lista sem registro, com navegação na parte inferior.
- Aplicar mês, coligada, família, tipo/recorte e local aos indicadores; grupo da frota quando houver vínculo.
- Prazo até o fim de cada ciclo de calendário. Registros não comprovam conclusão formal.
- Instalações: trimestral por local/aba. Extintores: mensal por local/aba.
- Veículos de rotina: mensal por veículo elegível; retirada 104 e devolução 105 ficam como eventos.
- Ferramentas: trimestral por instalação, nos recortes EAT/LT do BI, sem somar esses recortes como locais únicos.
- Carga 148: mensal; acessórios 149: bimestral.
- Cintos 150: trimestral por pessoa usuária. Identidade, população e Produto Novo pendentes.
- EPIs 151 e 468: bimestral, unidade/população pendentes; capacete 467: conforme demanda.
- Ficha 17: conforme demanda, sem meta periódica definida. Não descartar brigada sem ativo.
- Ficha 33 permanece pendente e fora do recorte aprovado.

## Dados

O painel deve consumir a consulta autenticada da manutenção. Dados de demonstração não devem ser incluídos no pacote público nem substituir dados publicados.
Ausência de carga, população desconhecida e zero confirmado são estados diferentes.
Posições por ciclo preservam data de corte e identificam população provisória ou homologada.
Filtros regionais só podem recalcular cobertura quando existe uma população individual completa para o recorte, ou uma unidade individual comprovada selecionada.
Não inferir coligada pelo texto do nome de um local. A frota usa correspondência exata entre concessão e cadastro de coligadas, preservando valores sem correspondência.
Meses sem extração não podem reutilizar números de outro mês. Metas antigas de atividades das OS não serão usadas como população das inspeções.

## Validações em aberto

Elegibilidade/vigência dos locais e frota; usuários de cinto; Produto Novo; conclusão formal; correspondência de coligadas; unidade/população de EPIs 151/468; ajustes manuais de datas; reconciliação do recorte LT.

## Implementação e disponibilidade

A aba existente importa `PainelCiclosManutencao`; cabeçalho, menu, autenticação e aba Segurança continuam nos componentes atuais. O endpoint autenticado `/api/inspecoes/manutencao?ano=AAAA` preserva o contrato anterior e acrescenta posições por ciclo e metadados de cobertura mensal.

O conteúdo mensal aceita o campo opcional `posicoes_ciclo`, validado tanto no preparador Python quanto no servidor Next.js. Nenhuma migração ou abertura de acesso é necessária. Sem posições publicadas, a tela apresenta somente registros de meses com extração confirmada; metas e listas individuais aguardam a carga correspondente. Atividades de OS não substituem a população elegível.

As consultas aprovadas podem ser convertidas para uma prévia local com `backend/intranet/converter_proposta_ciclos.py --entrada <evidencias-v2.json> --saida <arquivo-novo.json>`. O conversor não publica dados. O destino deve ficar em `data/bronze`, ignorado pelo Git. A prévia isolada lê esse arquivo pela variável de servidor `SSO_CICLOS_PREVIA_JSON`; nenhum dado corporativo fica no código público.

Antes da disponibilização: gerar e conferir as posições na extração SQL operacional, validar as populações pendentes, publicar a carga no ambiente escolhido e conferir o painel com sessão autenticada. Esta alteração de código não publica automaticamente no portal nem no banco.

## Conferência realizada

- 21 testes de regras, filtros, calendário, contrato mensal e paginação no frontend.
- 24 testes de validação e publicação no backend, sem acesso real ao banco.
- Verificação TypeScript sem erros.
- Prévia React com dados SQL conferidos: frota 121/92/29; paginação 10/10/9; CRTE 20/9/11; veículos pesados 14/10/4; outubro sem carga mostra ausência de valor; exportação contém as 29 unidades filtradas, além do resumo.

### Preparação para publicação em 17/11/2026

- Compilação completa do portal aprovada após atualização de `next` e `eslint-config-next` de 16.4.1 para 16.4.6. O bloqueio de segurança apareceu na etapa final da compilação anterior. Referências oficiais: [aviso de segurança](https://github.com/vercel/next.js/security/advisories/GHSA-rhh4-g77r-r9qj) e [versão 16.4.6](https://github.com/vercel/next.js/releases/tag/v16.4.6).
- Suíte completa do frontend: 169 testes aprovados, nenhuma falha, incluindo acesso às APIs reais com clientes simulados. Backend: 24 testes aprovados na conferência da implementação.
- Leitura dos ambientes de homologação e produção confirmou as mesmas competências: setembro (251 registros), outubro (740) e novembro (99), extraídas em 05/11/2026. Nenhuma contém `posicoes_ciclo`.
- A credencial SQL protegida pôde ser carregada, mas a abertura da conexão de origem falhou; não foi realizada nova extração. As consultas conferidas em 16/17 de novembro continuam como evidência local, sem substituir a carga de 5 de novembro.
- A conexão Vercel lista a equipe Segurança_Celeo, mas não retorna seus projetos. Foi solicitada autorização de acesso à equipe. Não foi criado outro projeto nem alterado o domínio existente.
- Publicação de dados e alteração da versão em produção permanecem pendentes. Não incorporar as posições de 16/17 de novembro a uma carga extraída em 5 de novembro: isso falsificaria a atualização dos registros.

### Revisão enviada em 18/11/2026

- [Pull request 28](https://github.com/crbsso/pipelinesso/pull/28), branch `feat/inspecoes-manutencao-ciclos-20261117`, criada pelo fluxo automático do repositório após o envio da branch. A referência remota do PR e da branch foi conferida contra `d5a5e022346b75891508e024238d527d22a95cfb` (código testado).
- Os commits de implementação são `e5e9ce3` (Next.js 16.4.6) e `d5a5e02` (painel por ciclo). A branch foi baseada em `origin/main` `e821c84`, sem alterações de produção posteriores na conferência de envio.
- Nova tentativa de leitura SQL em 18/11 falhou na abertura da conexão (`SqlException`, número -1), após a leitura bem-sucedida da credencial protegida. Nenhuma extração ou publicação foi executada.
- O acesso Vercel continua retornando uma lista vazia de projetos da equipe. Foi solicitada nova autorização ao usuário, pois o link anterior expirou.
- O leitor de verificações do PR informou que a conexão GitHub está indisponível; verificações remotas e eventual prévia automática ainda não foram confirmadas. A compilação e os 169 testes locais permanecem aprovados na versão enviada.
