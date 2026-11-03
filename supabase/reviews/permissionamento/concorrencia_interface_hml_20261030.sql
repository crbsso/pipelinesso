-- Exclusivo HML ckfsarzmudwdehiiltwi. Perfil de teste inativo e vazio.
-- Uma escrita de manutencao, sem identidade simulada, disputa com a interface real.
-- Reverte automaticamente se nao observar a RPC concorrente esperando a trava.
begin;
set local statement_timeout = '40s';
set local lock_timeout = '3s';
set local application_name = 'portal_sso_teste_concorrencia_hml';
select set_config('request.jwt.claim.sub','',true),set_config('request.jwt.claims','{}',true);
do $teste$
declare
 alvo constant uuid := 'e6706ce6-a7fa-4f23-a51b-cdd3d3ccafdb';
 versao_esperada constant text := '8fc7228a940ff3c23777f38a64852871';
 estado jsonb; anterior jsonb; atual jsonb; aguardando jsonb;
 inicio timestamptz; limite timestamptz; observado_em timestamptz;
 auditorias_antes bigint;
begin
 if auth.uid() is not null then raise exception 'Manutencao nao pode assumir identidade de usuario';end if;
 perform pg_advisory_xact_lock(1953751,1);
 select portal_acesso.perfil_json(alvo) into anterior;
 if anterior is null or anterior->>'nome'<>'Homologacao_teste_31.10.26'
   or anterior->>'versao'<>versao_esperada or (anterior->>'ativo')::boolean
   or jsonb_array_length(anterior->'capacidades')<>0
   or exists(select 1 from portal_acesso.atribuicoes where perfil_id=alvo)
   or not portal_acesso.ha_administrador_permanente()
 then raise exception 'Precondicao do perfil de teste divergente; nada sera gravado';end if;
 select count(*) into auditorias_antes from portal_acesso.auditoria;
 update portal_acesso.perfis set descricao='Teste de concorrência — versão preservada',
   atualizado_em=clock_timestamp() where id=alvo;
 set constraints all immediate;
 inicio:=clock_timestamp();
 limite:=inicio+interval '30 seconds';
 loop
  perform pg_stat_clear_snapshot();
  select coalesce(jsonb_agg(jsonb_build_object('pid',l.pid,'usuario_banco',s.usename,
    'aplicacao',s.application_name,'estado',s.state,'wait_event_type',s.wait_event_type,
    'wait_event',s.wait_event,'bloqueadores',pg_blocking_pids(l.pid))),'[]'::jsonb)
  into aguardando from pg_locks l join pg_stat_activity s on s.pid=l.pid
  where l.locktype='advisory' and l.classid=1953751::oid and l.objid=1::oid
    and l.objsubid=2 and not l.granted and l.pid<>pg_backend_pid()
    and position('gerir_acessos_portal' in s.query)>0
    and pg_backend_pid()=any(pg_blocking_pids(l.pid));
  if jsonb_array_length(aguardando)>0 then observado_em:=clock_timestamp();exit;end if;
  if clock_timestamp()>=limite then
   raise exception 'Nenhuma RPC concorrente observada em 30 segundos; alteracao revertida';
  end if;
  perform pg_sleep(0.25);
 end loop;
 atual:=portal_acesso.perfil_json(alvo);
 perform set_config('portal.evidencia_concorrencia',jsonb_build_object(
   'pid_manutencao',pg_backend_pid(),'inicio',inicio,'observado_em',observado_em,
   'rpc_aguardando',aguardando,'perfil_antes',anterior,'perfil_apos_manutencao',atual,
   'auditorias_antes',auditorias_antes,'auditorias_antes_do_commit',(select count(*) from portal_acesso.auditoria),
   'ator_manutencao',auth.uid(),'administrador_permanente_preservado',portal_acesso.ha_administrador_permanente())::text,true);
end $teste$;
select current_setting('portal.evidencia_concorrencia')::jsonb as evidencia;
commit;