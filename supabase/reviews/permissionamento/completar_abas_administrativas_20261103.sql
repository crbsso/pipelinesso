-- Executar SOMENTE depois de a Vercel publicar a versão com o catálogo de 19 permissões.
-- A versão anterior rejeita contextos com as oito capacidades novas.
-- Alteração solicitada: os dois perfis administrativos atuais recebem todas as abas.
-- Não cria usuários nem vínculos e não altera validade ou estado dos vínculos.
begin;
select pg_catalog.pg_advisory_xact_lock(1953751,1);
select set_config('request.jwt.claim.sub',(select id::text from auth.users
 where email='seguranca@celeogroup.com' and deleted_at is null),true);
do $$ begin
 if (select count(*) from portal_acesso.perfis where codigo='administracao_acessos' or nome='Administrador')<>2 then
   raise exception 'Os perfis administrativos mudaram. Revise os alvos antes de continuar.';
 end if;
end $$;
select set_config('portal.revisao.perfis',jsonb_agg(jsonb_build_object(
 'id',p.id,'codigo',p.codigo,'nome',p.nome,'descricao',p.descricao,'ativo',p.ativo,
 'versao',portal_acesso.perfil_json(p.id)->>'versao'))::text,true)
from portal_acesso.perfis p where p.codigo='administracao_acessos' or p.nome='Administrador';
set local role authenticated;
select public.gerir_acessos_portal('salvar_perfil',p||jsonb_build_object('capacidades',(
 select jsonb_agg(jsonb_build_object('modulo',m,'acao',
 case when m in ('usuarios','permissoes','solicitacoes_acesso') then 'gerenciar' else 'consultar' end))
 from unnest(array['avcb','inspecoes','planos_acao','acoes_corretivas','motoristas','motoristas_historico',
 'motoristas_direcao','motoristas_velocidade','visao_geral','extintores','ensaios','outros_indicadores',
 'rota_segura','regras_que_salvam_vidas','sipat','outros_programas',
 'usuarios','permissoes','solicitacoes_acesso']) m)))
from jsonb_array_elements(current_setting('portal.revisao.perfis')::jsonb) p;
select jsonb_array_length(public.obter_contexto_acesso_portal()->'perfis'->0->'concessoes') capacidades_administracao;
commit;
