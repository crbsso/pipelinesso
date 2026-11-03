-- Somente leitura em HML. Fotografia organizacional sem consultar responsaveis.
select now() as conferido_em,count(*) as registros,
count(distinct projeto) as projetos,count(distinct subestacao) as subestacoes,
count(distinct instalacao) as valores_instalacao,
count(*) filter(where nullif(btrim(projeto),'') is null or nullif(btrim(subestacao),'') is null or nullif(btrim(instalacao),'') is null) as chaves_vazias,
count(distinct (projeto,subestacao,instalacao)) as combinacoes_nativas,
(select jsonb_agg(to_jsonb(x) order by x.projeto) from(select projeto,count(*) registros,count(distinct subestacao) subestacoes from public.mart_avcb group by projeto order by projeto limit 40) x) as catalogo_projetos,
(select jsonb_agg(to_jsonb(x) order by x.instalacao) from(select instalacao,count(*) registros from public.mart_avcb group by instalacao order by instalacao limit 30) x) as catalogo_instalacao,
(select count(*) from(select subestacao from public.mart_avcb group by subestacao having count(distinct projeto)>1) x) as nomes_subestacao_em_mais_de_um_projeto
from public.mart_avcb;