-- Testes autorizados somente HML. Transacoes com ROLLBACK; simulacao de claims, nao substitui login HTTP real.
begin;
select set_config('request.jwt.claim.sub','6b08a067-e510-4356-85a0-91982b0d9353',true);
do $test$
declare
 a constant uuid:='9025f8aa-817d-4a63-b8b6-b3f29c7a5876';
 b constant uuid:='6b08a067-e510-4356-85a0-91982b0d9353';
 u jsonb; p jsonb; x jsonb; payload jsonb; r jsonb; sid uuid; n bigint; na bigint; ns bigint;
begin
 select count(*) into n from portal_acesso.auditoria;
 select count(*) into na from auth.users;
 select count(*) into ns from portal_acesso.atribuicoes;
 if not portal_acesso.ha_administrador_permanente() then raise exception 'Continuidade ausente';end if;
 if has_function_privilege('anon','public.gerir_acessos_portal(text,jsonb)','EXECUTE')
 or has_function_privilege('service_role','public.gerir_acessos_portal(text,jsonb)','EXECUTE')
 or has_function_privilege('authenticated','portal_acesso.tem_gestao(uuid,text,boolean)','EXECUTE')
 or has_table_privilege('authenticated','portal_acesso.atribuicoes','SELECT') then raise exception 'Privilegio indevido';end if;
 select i into u from jsonb_array_elements(public.gerir_acessos_portal('listar_usuarios','{"limite":100}')->'dados') i where i->>'usuario_id'=a::text;
 if u is null then raise exception 'DTO usuario ausente';end if;
 x:=public.gerir_acessos_portal('listar_atribuicoes',jsonb_build_object('usuarioId',a))->'dados'->0;
 p:=portal_acesso.perfil_json((x->>'perfil_id')::uuid);
 for payload in select v from (values
  (jsonb_build_object('op','salvar_usuario','dados',jsonb_build_object('id',a,'ativo',false,'versao',u->>'versao'))),
  (jsonb_build_object('op','salvar_perfil','dados',jsonb_build_object('id',p->>'id','codigo',p->>'codigo','nome',p->>'nome','ativo',false,'capacidades','[]'::jsonb,'versao',p->>'versao'))),
  (jsonb_build_object('op','estado_atribuicao','dados',jsonb_build_object('id',x->>'id','ativo',false,'versao',x->>'versao'))),
  (jsonb_build_object('op','salvar_atribuicao','dados',jsonb_build_object('id',x->>'id','usuarioId',a,'perfilId',p->>'id','ativo',true,'inicio',null,'fim','2026-11-01T12:00:00.000Z','abrangencias',x->'abrangencias','versao',x->>'versao')))
 ) casos(v) loop
  begin
   -- Campos de abrangencia do DTO sao projetados para o contrato de escrita.
   if payload->>'op'='salvar_atribuicao' then
    payload:=jsonb_set(payload,'{dados,abrangencias}',(select jsonb_agg(jsonb_build_object('modulo',v->>'modulo','acao',v->>'acao','tipo',v->>'tipo','unidades',v->'unidades')) from jsonb_array_elements(x->'abrangencias') v));
   end if;
   perform public.gerir_acessos_portal(payload->>'op',payload->'dados');
   set constraints all immediate;
   raise exception 'Protecao do ultimo administrador falhou';
  exception when sqlstate 'PT409' then null;end;
 end loop;
 if (select count(*) from portal_acesso.auditoria)<>n then raise exception 'Auditoria nao revertida';end if;
 begin
  perform public.gerir_acessos_portal('salvar_usuario',jsonb_build_object('id',a,'ativo',true,'versao','antiga'));
  raise exception 'Fingerprint antigo aceito';exception when sqlstate 'PT409' then null;end;
 begin
  perform public.gerir_acessos_portal('listar_usuarios','{"ator_id":"00000000-0000-4000-8000-000000000000"}');
  raise exception 'Ator externo aceito';exception when sqlstate 'PT400' then null;end;
 r:=public.gerir_acessos_portal('salvar_perfil',jsonb_build_object('codigo','teste_hml_rollback','nome','Teste transacional','ativo',true,'capacidades','[{"modulo":"motoristas","acao":"consultar"}]'::jsonb));
 if not exists(select 1 from portal_acesso.auditoria where autor_id=b and depois->>'id'=r->'perfil'->>'id') then raise exception 'Autoria nao verificada';end if;
 begin
  perform public.gerir_acessos_portal('salvar_atribuicao',jsonb_build_object('usuarioId',b,'perfilId',r->'perfil'->>'id','ativo',true,'inicio',null,'fim',null,'abrangencias','[{"modulo":"motoristas","acao":"consultar","tipo":"restrita","unidades":[{"secao_rm":"10"}]}]'::jsonb));
  raise exception 'Escopo invalido aceito';exception when sqlstate 'PT400' then null;end;
 insert into public.solicitacoes_acesso(nome_completo,email_corporativo,empresa,cargo_funcao,projeto_unidade,justificativa)
 values('Teste transacional','rollback-permissoes@example.invalid','Teste','Teste','Teste','Descartavel') returning id into sid;
 perform public.gerir_acessos_portal('analisar_solicitacao',jsonb_build_object('id',sid,'acao','APROVAR','observacao','Teste descartavel'));
 if not exists(select 1 from public.solicitacoes_acesso where id=sid and status='APROVADO' and analisado_por=b) then raise exception 'Analise sem autoria';end if;
 if (select count(*) from auth.users)<>na or (select count(*) from portal_acesso.atribuicoes)<>ns then raise exception 'Aprovacao provisionou acesso';end if;
 update portal_acesso.atribuicoes set fim=clock_timestamp()-interval '1 second' where user_id=b;
 begin
  perform public.gerir_acessos_portal('listar_usuarios');
  raise exception 'Gestao expirada aceita';exception when insufficient_privilege then null;end;
 perform set_config('portal.teste_resultado','privilegios,4 bloqueios de ultimo administrador,rollback de auditoria,fingerprint antigo,ator externo,autoria verificada,escopo nativo,analise sem provisionamento,expiracao: aprovados',true);
end $test$;
select current_setting('portal.teste_resultado') as resultado;
rollback;

begin;
select set_config('request.jwt.claim.sub','6b08a067-e510-4356-85a0-91982b0d9353',true);
do $test$ declare b constant uuid:='6b08a067-e510-4356-85a0-91982b0d9353'; p_modulo text; operacao text; negou boolean;
begin
 foreach p_modulo in array array['usuarios','permissoes','solicitacoes_acesso'] loop
 begin
  delete from portal_acesso.abrangencias e using portal_acesso.atribuicoes a where e.atribuicao_id=a.id and a.user_id=b and e.modulo=p_modulo;
  operacao:=case p_modulo when 'usuarios' then 'listar_usuarios' when 'permissoes' then 'listar_perfis' else 'listar_solicitacoes' end;
  negou:=false;
  begin perform public.gerir_acessos_portal(operacao);exception when insufficient_privilege then negou:=true;end;
  if not negou then raise exception 'Capacidade ausente nao foi negada: %',p_modulo;end if;
  if p_modulo<>'solicitacoes_acesso' then perform public.gerir_acessos_portal('listar_solicitacoes');end if;
  if p_modulo<>'usuarios' then perform public.gerir_acessos_portal('listar_usuarios');end if;
  if p_modulo<>'permissoes' then perform public.gerir_acessos_portal('listar_perfis');end if;
  raise exception using errcode='Z0001',message='Reverter cenario individual validado';
 exception when sqlstate 'Z0001' then null;end;
 end loop;
end $test$;
select '3 capacidades independentes: aprovadas; alteracoes descartadas' as resultado;
rollback;