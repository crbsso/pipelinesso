# Publicação da Manutenção em produção — 05/11/2026

Projeto de produção: pipelinesso / lkhidajhsqgebjltyicb.
Projeto de homologação independente: pipelinesso-homologacao / ckfsarzmudwdehiiltwi.

Publicação autorizada pelo usuário após homologação e merge da integração.

- Aplicadas em produção as três migrações já conferidas em homologação: inspeções isoladas da Manutenção, promoção mensal e snapshots do painel.
- A carga mensal foi executada como service_role: setembro 251 formulários/130 atividades; outubro 740/330; novembro 99/114. Total: 1.090 formulários, 171 OS e 574 atividades.
- Assinaturas SHA256 idênticas às cargas validadas em homologação. Nenhuma tabela do Prevsys foi alterada.
- RLS ativo e clientes anon/authenticated sem leitura direta da nova tabela.
- A aba e a API aceitam somente as URLs exatas dos dois projetos validados e preservam a autorização existente de Inspeções.
- O publicador agora oferece produção com confirmação explícita da referência do projeto; não permite confundir o ambiente selecionado com a URL de destino.
- Testes desta liberação: 27 do backend e 128 do frontend/permissões aprovados. Compilação com a configuração pública de produção.
- Publicação do portal pela integração existente entre main e Vercel. O estado final do deploy é acompanhado no GitHub/Vercel após o envio desta versão.

Limitação da conferência visual: a ferramenta de navegação do Windows interrompeu a operação por não conseguir confirmar a URL da janela. Verificação realizada por compilação, testes de autorização, conferência SQL e status do deploy.