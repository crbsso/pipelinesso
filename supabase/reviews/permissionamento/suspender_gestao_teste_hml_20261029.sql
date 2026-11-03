-- HML ckfsarzmudwdehiiltwi: teste de revogacao autorizado pelo usuario.
-- Suspender somente a atribuicao temporaria da segunda conta.
-- Nao reaplicar quando o estado esperado ou a configuracao divergirem.
begin;
do $teste$
declare
 atribuicao uuid;
 perfil uuid;
 capacidades text[];
 escopos text[];
 vazios boolean;
 alteradas integer;
begin
 select a.id,a.perfil_id into strict atribuicao,perfil
 from portal_acesso.atribuicoes a
 join portal_acesso.perfis p on p.id=a.perfil_id
 join public.perfis_portal i on i.user_id=a.user_id
 join auth.users u on u.id=i.user_id
 where lower(u.email)='seguranca@celeogroup.com'
   and u.email_confirmed_at is not null and u.deleted_at is null
   and not coalesce(u.banned_until > now(),false) and not u.is_anonymous
   and i.papel='USUARIO' and i.ativo and p.codigo='administracao_acessos_hml' and p.ativo
   and a.ativo=true
   and a.inicio=timestamptz '2026-10-29T18:43:20.625Z'
   and a.fim=timestamptz '2026-10-30T18:43:20.625Z' and now()<a.fim
 for update of a;
 select array_agg(modulo||'.'||acao order by modulo) into capacidades
 from portal_acesso.permissoes_perfil where perfil_id=perfil and ativo;
 select array_agg(modulo||'.'||acao||':'||tipo order by modulo), bool_and(unidades='[]'::jsonb)
 into escopos,vazios from portal_acesso.abrangencias where atribuicao_id=atribuicao;
 if capacidades is distinct from array['permissoes.gerenciar','solicitacoes_acesso.gerenciar','usuarios.gerenciar']
    or escopos is distinct from array['permissoes.gerenciar:corporativa','solicitacoes_acesso.gerenciar:corporativa','usuarios.gerenciar:corporativa']
    or vazios is distinct from true then
   raise exception 'Capacidades ou abrangencias divergentes; revisar antes de prosseguir.';
 end if;
 update portal_acesso.atribuicoes set ativo=false
 where id=atribuicao and ativo=true;
 get diagnostics alteradas=row_count;
 if alteradas<>1 or (select count(*) from portal_acesso.auditoria where transacao=txid_current())<>1 then
   raise exception 'Alteracao ou auditoria divergente.';
 end if;
 if not exists(select 1 from portal_acesso.atribuicoes where id=atribuicao
   and inicio=timestamptz '2026-10-29T18:43:20.625Z'
   and fim=timestamptz '2026-10-30T18:43:20.625Z') then
   raise exception 'Vigencia alterada durante o teste.';
 end if;
end;
$teste$;
commit;
select a.ativo as atribuicao_ativa,i.ativo as identidade_ativa,i.papel as papel_base,
 a.inicio,a.fim,(select count(*) from portal_acesso.abrangencias b where b.atribuicao_id=a.id) as abrangencias,
 (select count(*) from portal_acesso.abrangencias b where b.atribuicao_id=a.id and b.acao='consultar') as concessoes_de_dados
from portal_acesso.atribuicoes a join public.perfis_portal i on i.user_id=a.user_id
join auth.users u on u.id=a.user_id join portal_acesso.perfis p on p.id=a.perfil_id
where lower(u.email)='seguranca@celeogroup.com' and p.codigo='administracao_acessos_hml';
