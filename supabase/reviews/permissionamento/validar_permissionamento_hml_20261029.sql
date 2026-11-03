-- HML: testes de banco com identidade simulada; NAO equivale a login HTTP.
-- Executar somente no projeto ckfsarzmudwdehiiltwi, mediante autorizacao.
-- Todas as alteracoes de configuracao abaixo sao desfeitas por ROLLBACK.
begin;
do $testes$
declare
 usuario uuid;
 perfil uuid;
 atribuicao uuid;
 abrangencia uuid;
 perfil_admin uuid;
 contexto jsonb;
 tecnico jsonb;
 auditorias_iniciais bigint;
begin
 select id into strict usuario from auth.users where lower(email)=lower('vinicius.brum@celeogroup.com');
 select id into strict perfil_admin from portal_acesso.perfis where codigo='administracao_acessos_hml';
 select count(*) into auditorias_iniciais from portal_acesso.auditoria;
 if exists(select 1 from portal_acesso.perfis where codigo='teste_rollback_permissoes_20261029') then
   raise exception 'Fixture ja existente; reconciliar antes de executar.';
 end if;

 -- 1: consulta propria e administracao sem concessao de dados.
 perform set_config('request.jwt.claim.sub',usuario::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',usuario::text,'role','authenticated')::text,true);
 set local role authenticated;
 contexto := public.obter_contexto_acesso_portal();
 if contexto->>'usuarioId' <> usuario::text or contexto->>'ativo' <> 'true'
    or jsonb_array_length(contexto->'perfis') <> 1
    or jsonb_array_length(contexto->'perfis'->0->'concessoes') <> 3
    or jsonb_path_exists(contexto,'$.perfis[*].concessoes[*] ? (@.acoes[0] == "consultar")') then
   raise exception 'Contexto administrativo divergente.';
 end if;

 -- 2: leitura direta das tabelas internas e da identidade e negada.
 begin perform count(*) from portal_acesso.perfis;
   raise exception 'Leitura interna indevida.';
 exception when insufficient_privilege then null; end;
 begin perform count(*) from public.perfis_portal;
   raise exception 'Leitura direta de identidades indevida.';
 exception when insufficient_privilege then null; end;

 -- 3: sessao sem identidade e anon nao podem chamar o contexto.
 perform set_config('request.jwt.claim.sub','',true);
 perform set_config('request.jwt.claims','{}',true);
 begin perform public.obter_contexto_acesso_portal();
   raise exception 'Consulta sem identidade foi aceita.';
 exception when insufficient_privilege then null; end;
 reset role;
 set local role anon;
 begin perform public.obter_contexto_acesso_portal();
   raise exception 'Anon executou a consulta.';
 exception when insufficient_privilege then null; end;
 reset role;

 -- 4: identidade inexistente nao recebe o contexto de outra pessoa.
 perform set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000000',true);
 perform set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000000","role":"authenticated"}',true);
 set local role authenticated;
 contexto := public.obter_contexto_acesso_portal();
 if contexto->>'ativo' <> 'false' or contexto->'perfis' <> '[]'::jsonb then
   raise exception 'Identidade sem perfil recebeu acesso.';
 end if;
 reset role;
 perform set_config('request.jwt.claim.sub','',true);
 perform set_config('request.jwt.claims','{}',true);

 insert into portal_acesso.perfis(codigo,nome)
 values('teste_rollback_permissoes_20261029','Fixture temporaria de homologacao') returning id into perfil;
 insert into portal_acesso.permissoes_perfil(perfil_id,modulo,acao) values(perfil,'motoristas','consultar');
 insert into portal_acesso.atribuicoes(user_id,perfil_id,inicio,fim)
 values(usuario,perfil,'2026-10-28T00:00:00Z','2026-10-29T00:00:00Z') returning id into atribuicao;
 insert into portal_acesso.abrangencias(atribuicao_id,perfil_id,modulo,acao,tipo,unidades)
 values(atribuicao,perfil,'motoristas','consultar','restrita',
 '[{"coligada":"TESTE_HML_A","secao_rm":"1"},{"coligada":"TESTE_HML_B","secao_rm":"2"}]') returning id into abrangencia;

 -- 5: contexto preserva combinacoes e serializa a vigencia UTC para a politica.
 perform set_config('request.jwt.claim.sub',usuario::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',usuario::text,'role','authenticated')::text,true);
 set local role authenticated;
 contexto := public.obter_contexto_acesso_portal();
 select value into strict tecnico from jsonb_array_elements(contexto->'perfis')
 where value->>'perfil'='teste_rollback_permissoes_20261029';
 if tecnico->>'inicio' <> '2026-10-28T00:00:00.000Z'
    or tecnico->>'fim' <> '2026-10-29T00:00:00.000Z'
    or tecnico->'concessoes'->0->'abrangencia'->'unidades' <>
    '[{"coligada":"TESTE_HML_A","secao_rm":"1"},{"coligada":"TESTE_HML_B","secao_rm":"2"}]'::jsonb then
   raise exception 'Contrato de abrangencia/vigencia divergente.';
 end if;
 reset role;

 -- 6: restricoes do banco rejeitam escopos vazios, ambiguos e perfil trocado.
 begin update portal_acesso.abrangencias set unidades='[]' where id=abrangencia;
   raise exception 'Escopo vazio foi aceito.';
 exception when check_violation then null; end;
 begin update portal_acesso.abrangencias set unidades='[{"secao_rm":"1"}]' where id=abrangencia;
   raise exception 'Secao sem coligada foi aceita.';
 exception when check_violation then null; end;
 begin update portal_acesso.abrangencias set perfil_id=perfil_admin where id=abrangencia;
   raise exception 'Troca de perfil foi aceita.';
 exception when foreign_key_violation then null; end;

 -- 7: revogacao e refletida pela proxima consulta do contexto.
 update portal_acesso.permissoes_perfil set ativo=false where perfil_id=perfil;
 set local role authenticated;
 contexto := public.obter_contexto_acesso_portal();
 select value into strict tecnico from jsonb_array_elements(contexto->'perfis')
 where value->>'perfil'='teste_rollback_permissoes_20261029';
 if tecnico->'concessoes' <> '[]'::jsonb then raise exception 'Revogacao nao refletida.'; end if;
 reset role;
 update portal_acesso.permissoes_perfil set ativo=true where perfil_id=perfil;

 -- 8: estado do perfil e da atribuicao e transmitido como inativo.
 update portal_acesso.perfis set ativo=false where id=perfil;
 set local role authenticated;
 contexto := public.obter_contexto_acesso_portal();
 select value into strict tecnico from jsonb_array_elements(contexto->'perfis')
 where value->>'perfil'='teste_rollback_permissoes_20261029';
 if tecnico->>'ativo' <> 'false' then raise exception 'Perfil inativo nao refletido.'; end if;
 reset role;
 update portal_acesso.perfis set ativo=true where id=perfil;
 update portal_acesso.atribuicoes set ativo=false where id=atribuicao;
 set local role authenticated;
 contexto := public.obter_contexto_acesso_portal();
 select value into strict tecnico from jsonb_array_elements(contexto->'perfis')
 where value->>'perfil'='teste_rollback_permissoes_20261029';
 if tecnico->>'ativo' <> 'false' then raise exception 'Atribuicao inativa nao refletida.'; end if;
 reset role;

 -- 9: usuario inativo nao recebe sequer as concessoes administrativas.
 update public.perfis_portal set ativo=false where user_id=usuario;
 set local role authenticated;
 contexto := public.obter_contexto_acesso_portal();
 if contexto->>'ativo' <> 'false' or contexto->'perfis' <> '[]'::jsonb then
   raise exception 'Usuario inativo manteve contexto.';
 end if;
 reset role;
 update public.perfis_portal set ativo=true where user_id=usuario;

 -- 10: auditoria acompanhou as alteracoes; cliente nao pode apaga-la.
 if (select count(*) from portal_acesso.auditoria) <= auditorias_iniciais then
   raise exception 'Auditoria nao registrou as alteracoes.';
 end if;
 set local role authenticated;
 begin delete from portal_acesso.auditoria;
   raise exception 'Cliente conseguiu apagar auditoria.';
 exception when insufficient_privilege then null; end;
 reset role;
end;
$testes$;
rollback;
select jsonb_build_object(
 'verificacoes_sql_aprovadas',10,
 'fixture_persistida',exists(select 1 from portal_acesso.perfis where codigo='teste_rollback_permissoes_20261029'),
 'administradores_ativos',(select count(*) from public.perfis_portal where papel='ADMIN_SSO' and ativo),
 'perfis_persistentes',(select count(*) from portal_acesso.perfis),
 'atribuicoes_persistentes',(select count(*) from portal_acesso.atribuicoes),
 'concessoes_de_dados',(select count(*) from portal_acesso.abrangencias where acao='consultar'),
 'auditorias',(select count(*) from portal_acesso.auditoria)
) as teste_hml;
