-- Concessao temporaria autorizada pelo usuario em 29/10/2026.
-- Executar somente em ckfsarzmudwdehiiltwi (pipelinesso-homologacao).
-- Nao provisiona conta, altera senha, promove ADMIN_SSO ou concede consulta.
-- Aplicacao unica: se a identidade ja existir, interromper e revisar.
begin;
do $concessao$
declare
 usuario uuid;
 perfil uuid;
 atribuicao uuid;
 capacidades text[];
 todas_ativas boolean;
 inicio_teste timestamptz := date_trunc('milliseconds', clock_timestamp());
 admins_antes bigint;
begin
 select id into strict usuario from auth.users
 where lower(email)='seguranca@celeogroup.com'
   and email_confirmed_at is not null and deleted_at is null
   and not coalesce(banned_until > now(),false) and not is_anonymous
 for update;
 select id into strict perfil from portal_acesso.perfis
 where codigo='administracao_acessos_hml' and ativo for share;
 perform 1 from portal_acesso.permissoes_perfil where perfil_id=perfil for share;
 select array_agg(modulo || '.' || acao order by modulo), bool_and(ativo)
 into capacidades, todas_ativas from portal_acesso.permissoes_perfil where perfil_id=perfil;
 if capacidades is distinct from array['permissoes.gerenciar','solicitacoes_acesso.gerenciar','usuarios.gerenciar']
    or todas_ativas is distinct from true then
   raise exception 'Capacidades do perfil divergentes do escopo autorizado.';
 end if;
 if exists(select 1 from public.perfis_portal where user_id=usuario)
    or exists(select 1 from portal_acesso.atribuicoes where user_id=usuario) then
   raise exception 'Conta ja configurada. Nao repetir ou sobrescrever a concessao.';
 end if;
 select count(*) into admins_antes from public.perfis_portal where papel='ADMIN_SSO' and ativo;
 if admins_antes < 1 then raise exception 'Administracao original ausente.'; end if;
 insert into public.perfis_portal(user_id,papel,ativo) values(usuario,'USUARIO',true);
 insert into portal_acesso.atribuicoes(user_id,perfil_id,ativo,inicio,fim)
 values(usuario,perfil,true,inicio_teste,inicio_teste+interval '24 hours')
 returning id into atribuicao;
 insert into portal_acesso.abrangencias(atribuicao_id,perfil_id,modulo,acao,tipo,unidades)
 select atribuicao,perfil,m,'gerenciar','corporativa','[]'::jsonb
 from unnest(array['usuarios','permissoes','solicitacoes_acesso']) as modulos(m);
 if (select count(*) from portal_acesso.abrangencias where atribuicao_id=atribuicao) <> 3
    or exists(select 1 from portal_acesso.abrangencias where atribuicao_id=atribuicao and acao='consultar')
    or (select count(*) from portal_acesso.auditoria where transacao=txid_current()) <> 5
    or (select count(*) from public.perfis_portal where papel='ADMIN_SSO' and ativo) <> admins_antes then
   raise exception 'Pos-condicoes da concessao ou auditoria divergentes.';
 end if;
end;
$concessao$;
commit;

select jsonb_build_object(
 'ambiente','homologacao',
 'papel_base',i.papel,'identidade_ativa',i.ativo,'perfil',p.codigo,
 'inicio_utc',a.inicio,'fim_utc',a.fim,
 'duracao_horas',extract(epoch from (a.fim-a.inicio))/3600,
 'capacidades',(select jsonb_agg(b.modulo || '.' || b.acao order by b.modulo) from portal_acesso.abrangencias b where b.atribuicao_id=a.id),
 'concessoes_de_dados',(select count(*) from portal_acesso.abrangencias b join portal_acesso.atribuicoes x on x.id=b.atribuicao_id where x.user_id=u.id and b.acao='consultar'),
 'administradores_legados_ativos',(select count(*) from public.perfis_portal where papel='ADMIN_SSO' and ativo),
 'auditorias_da_concessao',(select count(*) from portal_acesso.auditoria e where e.transacao=(select e2.transacao from portal_acesso.auditoria e2 where e2.entidade='public.perfis_portal' and e2.operacao='INSERT' and e2.depois->>'user_id'=u.id::text))
) as concessao
from auth.users u
join public.perfis_portal i on i.user_id=u.id
join portal_acesso.atribuicoes a on a.user_id=u.id
join portal_acesso.perfis p on p.id=a.perfil_id
where lower(u.email)='seguranca@celeogroup.com' and p.codigo='administracao_acessos_hml';