# Testes de permissionamento e gestao

Requer Node.js 24 LTS (validado com 24.22.0). Instale os dois conjuntos de dependencias fixados nos lockfiles:

```powershell
npm ci --ignore-scripts
npm --prefix frontend ci --ignore-scripts
npm run test:permissoes
```

As dependencias da raiz incluem PGlite 0.5.13. As do frontend fornecem React/TypeScript para os testes de renderizacao. Nenhum novo pacote de testes foi acrescentado nesta etapa. ignore-scripts evita instaladores e nao prepara o binario do CLI Supabase; os testes nao precisam desse binario.

Resultado atual: 78 testes aprovados. O runner nativo remove tipos, mas nao os verifica; pode emitir MODULE_TYPELESS_PACKAGE_JSON. Nao muda o tipo de modulo de toda a aplicacao.

Os testes de banco selecionam migrations por sufixo unico. O conjunto inicial executa as duas migrations de permissao. O conjunto de gestao executa tambem a terceira, depois de um bootstrap ficticio explicito; um caso confirma a recusa sem administrador permanente. Tudo ocorre em PostgreSQL 18.6 em memoria. Nao leem .env, nao usam contas reais e nao conectam ao Supabase.

As fixtures simulam papeis e identidade. O teste HTTP injeta o cliente da sessao e confirma que somente a operacao fixa da rota chega a RPC; campos de ator/papel desconhecidos sao rejeitados pelo SQL. Os testes de tela renderizam os componentes reais com React e dados ficticios. Nao comprovam cookies, PostgREST, navegacao real ou concorrencia entre sessoes.

## Tipos e verificacoes

```powershell
cd frontend
node node_modules/typescript/bin/tsc --noEmit --incremental false
node node_modules/eslint/bin/eslint.js src/lib/gestao src/components/gestao src/app/api/gestao "src/app/(admin)/gestao" src/layout/AppSidebar.tsx src/svg.d.ts
npm run build -- --webpack
```

A compilacao e os tipos usam as dependencias instaladas nesta worktree. A declaracao de SVG corresponde ao componente criado pelo SVGR ja configurado. O build nao configura um ambiente de homologacao ou deploy.

## Limites e fronteiras

- As rotas de gestao usam requirePermission e a RPC protegida; a terceira migration foi aplicada somente em HML. Consulte docs/security/HOMOLOGACAO_GESTAO_20261030.md para o estado atual.
- As rotas operacionais de consulta ainda nao foram integradas ao novo modelo. Escopos devem ser aplicados no banco/servidor antes de produzir detalhes, totais, rankings ou filtros.
- O carregador exige getUser, confere a identidade do retorno e nao armazena concessoes em cache entre requisicoes.
- Somente o cliente da sessao deve chegar ao carregador e a gestao. A gestao nao usa chave administrativa.
- A RPC administrativa escolhe o ator por auth.uid(), nunca por dados do pedido, e confirma as capacidades novamente no banco.
- Fim da vigencia e exclusivo; datas sao UTC ISO 8601.
- Gates operacionais permanecem independentes.
- A trava do ultimo administrador exige continuidade permanente; uma concessao temporaria nao basta.
- PGlite usa uma unica conexao. Em HML/PostgreSQL 17 foi comprovado um caso real com duas sessoes: manutencao SQL e RPC pela interface, espera em advisory lock e rejeicao da versao antiga. Alcance e evidencias em CONCORRENCIA_GESTAO_20261030.json; nao representa todos os cenarios concorrentes.

O relatorio atual e docs/security/INTEGRACAO_GESTAO_ACESSOS_LOCAL_20261029.md. A falha critica de Next.js existente foi tratada na atualizacao pontual autorizada de 30/10/2026: Next.js/eslint-config-next 16.4.1 e PostCSS 8.5.23. Testes, tipos, lint e build passaram. Restam 15 registros do npm audit em outras dependencias, sem criticos; nao houve audit fix automatico ou publicacao.

## Origem confiavel das gravacoes

Defina PORTAL_SSO_ORIGIN somente no servidor com a origem publica exata deste ambiente, por exemplo http://127.0.0.1:3001 no teste local. A variavel nao usa NEXT_PUBLIC_ e nao vem do corpo nem de Host/X-Forwarded-Host. Deve conter apenas protocolo http/https, dominio e porta normalizados, sem caminho, credenciais, query, fragmento ou barra final. Configuracao presente invalida nega a operacao; ausencia preserva comparacao com request.url, que pode divergir da origem externa atras de proxy. Configure a origem explicitamente antes de homologar outro ambiente; nao use curingas ou aliases.

A correcao elevou a suite a 78 testes e inclui a divergencia localhost/127.0.0.1 observada no Next.js real.
