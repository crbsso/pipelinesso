-- Preservar somente a administracao ja existente na producao lkhidajhsqgebjltyicb.
-- Executar depois das duas migrations de base e antes da integracao da gestao.
-- Nao provisiona contas, altera senhas ou concede consultas.
begin;
do $bootstrap$
declare u uuid; p uuid; a uuid;
begin
 if (select count(*) from public.perfis_portal where papel='ADMIN_SSO' and ativo)<>1 then
  raise exception 'Administracao de producao mudou. Revisar antes de continuar.';
 end if;
 select i.user_id into strict u from public.perfis_portal i join auth.users au on au.id=i.user_id
 where au.email='seguranca@celeogroup.com' and i.papel='ADMIN_SSO' and i.ativo
  and au.email_confirmed_at is not null and au.deleted_at is null and not coalesce(au.is_anonymous,false)
  and not coalesce(au.banned_until>now(),false) for update of i;
 if exists(select 1 from portal_acesso.perfis) or exists(select 1 from portal_acesso.atribuicoes) then
  raise exception 'Base de permissoes ja configurada. Nao repetir o bootstrap.';
 end if;
 insert into portal_acesso.perfis(codigo,nome,descricao) values('administracao_acessos','Administracao de acessos','Gestao de usuarios, perfis e solicitacoes do Portal SSO.') returning id into p;
 insert into portal_acesso.permissoes_perfil(perfil_id,modulo,acao)
 select p,m,'gerenciar' from unnest(array['usuarios','permissoes','solicitacoes_acesso']) m;
 insert into portal_acesso.atribuicoes(user_id,perfil_id,ativo,inicio,fim) values(u,p,true,null,null) returning id into a;
 insert into portal_acesso.abrangencias(atribuicao_id,perfil_id,modulo,acao,tipo,unidades)
 select a,p,m,'gerenciar','corporativa','[]'::jsonb from unnest(array['usuarios','permissoes','solicitacoes_acesso']) m;
end;
$bootstrap$;
commit;
