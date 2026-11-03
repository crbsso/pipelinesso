-- Integracao LOCAL de gestao de acessos. Revisar antes de aplicar em HML.
-- Sem provisionamento Auth, bootstrap, concessao automatica ou alteracao operacional.
begin;

create function portal_acesso.tem_gestao(p_usuario uuid, p_modulo text, p_permanente boolean default false)
returns boolean language sql volatile security invoker set search_path = '' as $$
 select exists(
   select 1 from public.perfis_portal i join auth.users u on u.id=i.user_id
   join portal_acesso.atribuicoes a on a.user_id=i.user_id
   join portal_acesso.perfis p on p.id=a.perfil_id
   join portal_acesso.permissoes_perfil pp on pp.perfil_id=p.id
   join portal_acesso.abrangencias b on b.atribuicao_id=a.id and b.perfil_id=p.id
     and b.modulo=pp.modulo and b.acao=pp.acao
   where i.user_id=p_usuario and i.ativo and u.deleted_at is null
     and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false)
     and not coalesce(u.banned_until>clock_timestamp(),false)
     and a.ativo and p.ativo and pp.ativo and pp.modulo=p_modulo and pp.acao='gerenciar'
     and b.tipo='corporativa' and b.unidades='[]'::jsonb
     and (a.inicio is null or a.inicio<=clock_timestamp())
     and (a.fim is null or (not p_permanente and a.fim>clock_timestamp()))
 );
$$;

create function portal_acesso.ha_administrador_permanente()
returns boolean language sql stable security invoker set search_path = '' as $$
 select exists(select 1 from public.perfis_portal i where i.ativo
   and portal_acesso.tem_gestao(i.user_id,'usuarios',true)
   and portal_acesso.tem_gestao(i.user_id,'permissoes',true)
   and portal_acesso.tem_gestao(i.user_id,'solicitacoes_acesso',true));
$$;

-- Um gestor temporario nao substitui a continuidade da administracao.
do $$ begin
 if not portal_acesso.ha_administrador_permanente() then
   raise exception using errcode='PT409', message='Defina e valide um administrador permanente antes desta migration.';
 end if;
end $$;

-- Todas as escritas de configuracao sao serializadas, inclusive manutencao SQL.
-- Par de chaves fixo e reservado ao controle de acessos deste portal.
create function portal_acesso.serializar_gestao()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
 perform pg_catalog.pg_advisory_xact_lock(1953751,1);
 return null;
end;
$$;
create function portal_acesso.preservar_administrador()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if not portal_acesso.ha_administrador_permanente() then
   raise exception using errcode='PT409',
     message='A alteracao removeria o ultimo administrador permanente. Cadastre outro administrador permanente antes de continuar.';
 end if;
 return null;
end;
$$;

create trigger portal_gestao_lock before insert or update or delete on public.perfis_portal
 for each statement execute function portal_acesso.serializar_gestao();
create constraint trigger portal_gestao_continuidade after insert or update or delete on public.perfis_portal
 deferrable initially deferred for each row execute function portal_acesso.preservar_administrador();
create trigger portal_gestao_lock before insert or update or delete on portal_acesso.perfis
 for each statement execute function portal_acesso.serializar_gestao();
create constraint trigger portal_gestao_continuidade after insert or update or delete on portal_acesso.perfis
 deferrable initially deferred for each row execute function portal_acesso.preservar_administrador();
create trigger portal_gestao_lock before insert or update or delete on portal_acesso.permissoes_perfil
 for each statement execute function portal_acesso.serializar_gestao();
create constraint trigger portal_gestao_continuidade after insert or update or delete on portal_acesso.permissoes_perfil
 deferrable initially deferred for each row execute function portal_acesso.preservar_administrador();
create trigger portal_gestao_lock before insert or update or delete on portal_acesso.atribuicoes
 for each statement execute function portal_acesso.serializar_gestao();
create constraint trigger portal_gestao_continuidade after insert or update or delete on portal_acesso.atribuicoes
 deferrable initially deferred for each row execute function portal_acesso.preservar_administrador();
create trigger portal_gestao_lock before insert or update or delete on portal_acesso.abrangencias
 for each statement execute function portal_acesso.serializar_gestao();
create constraint trigger portal_gestao_continuidade after insert or update or delete on portal_acesso.abrangencias
 deferrable initially deferred for each row execute function portal_acesso.preservar_administrador();

create function portal_acesso.perfil_json(p_id uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$
 select to_jsonb(p)||jsonb_build_object('capacidades',c.itens,'versao',md5(to_jsonb(p)::text||c.itens::text))
 from portal_acesso.perfis p cross join lateral(
   select coalesce(jsonb_agg(jsonb_build_object('modulo',pp.modulo,'acao',pp.acao,'ativo',pp.ativo)
     order by pp.modulo,pp.acao),'[]'::jsonb) itens
   from portal_acesso.permissoes_perfil pp where pp.perfil_id=p.id
 ) c where p.id=p_id;
$$;
create function portal_acesso.atribuicao_json(p_id uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$
 select to_jsonb(a)||jsonb_build_object('abrangencias',b.itens,'perfil_nome',p.nome,'perfil',portal_acesso.perfil_json(p.id),
   'versao',md5(to_jsonb(a)::text||b.itens::text||portal_acesso.perfil_json(p.id)::text))
 from portal_acesso.atribuicoes a join portal_acesso.perfis p on p.id=a.perfil_id cross join lateral(
   select coalesce(jsonb_agg(jsonb_build_object('modulo',x.modulo,'acao',x.acao,'tipo',x.tipo,'unidades',x.unidades)
     order by x.modulo,x.acao),'[]'::jsonb) itens
   from portal_acesso.abrangencias x where x.atribuicao_id=a.id
 ) b where a.id=p_id;
$$;

create function portal_acesso.validar_campos(p_dados jsonb,p_campos text[])
returns void language plpgsql immutable security invoker set search_path = '' as $$
begin
 if p_dados is null or jsonb_typeof(p_dados)<>'object' or octet_length(p_dados::text)>65536
    or exists(select 1 from jsonb_object_keys(p_dados) k where not(k=any(p_campos))) then
   raise exception using errcode='PT400',message='Conteudo da operacao invalido.';
 end if;
end;
$$;

-- Unica entrada administrativa privilegiada, privada e sem parametro de ator.
-- O corpo escolhe alvos, nunca a identidade que autoriza a operacao.
create function portal_acesso.executar_gestao(p_operacao text,p_dados jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
 ator uuid:=auth.uid();
 v_modulo text;
 escrita boolean;
 alvo uuid;
 perfil uuid;
 existente jsonb;
 versao text;
 linha jsonb;
 item jsonb;
 cap jsonb;
 pagina integer;
 limite integer;
 busca text;
 status_filtro text;
 empresa_filtro text;
 v_inicio timestamptz;
 v_fim timestamptz;
 v_ativo boolean;
 resultado jsonb;
begin
 v_modulo:=case
   when p_operacao in ('listar_usuarios','salvar_usuario','listar_atribuicoes','salvar_atribuicao','estado_atribuicao','catalogo_perfis') then 'usuarios'
   when p_operacao in ('listar_perfis','salvar_perfil','listar_auditoria') then 'permissoes'
   when p_operacao in ('listar_solicitacoes','analisar_solicitacao') then 'solicitacoes_acesso'
   else null end;
 if v_modulo is null then raise exception using errcode='PT400',message='Operacao desconhecida.'; end if;
 escrita:=p_operacao in ('salvar_usuario','salvar_perfil','salvar_atribuicao','estado_atribuicao','analisar_solicitacao');
 -- Negar antes da trava evita enfileirar pedidos sem capacidade de gestao.
 if ator is null or not portal_acesso.tem_gestao(ator,v_modulo) then
   raise exception using errcode='42501',message='Permissao de gestao obrigatoria.';
 end if;
 if p_operacao in ('salvar_atribuicao','estado_atribuicao')
    and not portal_acesso.tem_gestao(ator,'permissoes') then
   raise exception using errcode='42501',message='Gestao de usuarios e permissoes obrigatorias para alterar concessoes.';
 end if;
 if escrita then
   perform pg_catalog.pg_advisory_xact_lock(1953751,1);
   -- Revalidar apos eventual espera: revogacao e expiracao nao podem ser ignoradas.
   if not portal_acesso.tem_gestao(ator,v_modulo)
      or (p_operacao in ('salvar_atribuicao','estado_atribuicao') and not portal_acesso.tem_gestao(ator,'permissoes')) then
     raise exception using errcode='42501',message='A permissao mudou ou venceu. Atualize a tela.';
   end if;
 end if;

 if p_operacao in ('listar_usuarios','listar_perfis','catalogo_perfis','listar_auditoria','listar_solicitacoes') then
   perform portal_acesso.validar_campos(p_dados,array['busca','pagina','limite','status','empresa']);
   if (p_dados?'pagina' and (jsonb_typeof(p_dados->'pagina')<>'number' or p_dados->>'pagina' !~ '^[0-9]+$'))
      or (p_dados?'limite' and (jsonb_typeof(p_dados->'limite')<>'number' or p_dados->>'limite' !~ '^[0-9]+$'))
      or (p_dados?'busca' and jsonb_typeof(p_dados->'busca')<>'string') then
     raise exception using errcode='PT400',message='Filtros invalidos.';
   end if;
   pagina:=coalesce((p_dados->>'pagina')::integer,1);
   limite:=coalesce((p_dados->>'limite')::integer,25);
   busca:=btrim(coalesce(p_dados->>'busca',''));
   if pagina not between 1 and 100000 or limite not between 1 and 100 or length(busca)>254 then
     raise exception using errcode='PT400',message='Paginacao ou busca invalida.';
   end if;

   if p_operacao='listar_usuarios' then
     with lista as (
       select u.id usuario_id,u.email,(u.email_confirmed_at is not null) confirmado,
         coalesce(i.ativo,false) ativo,(i.user_id is not null) cadastrado,i.papel papel_legado,
         case when i.user_id is null then null else md5(to_jsonb(i)::text) end versao
       from auth.users u left join public.perfis_portal i on i.user_id=u.id
       where u.deleted_at is null and not coalesce(u.is_anonymous,false)
         and coalesce(u.email,'') ilike '%'||busca||'%'
     )
     select jsonb_build_object('total',(select count(*) from lista),'pagina',pagina,'limite',limite,
       'dados',coalesce((select jsonb_agg(to_jsonb(x) order by x.email,x.usuario_id)
          from (select * from lista order by email,usuario_id limit limite offset (pagina-1)*limite) x),'[]'::jsonb))
       into resultado;
   elsif p_operacao in ('listar_perfis','catalogo_perfis') then
     with lista as(select p.id,p.codigo from portal_acesso.perfis p
       where p.nome ilike '%'||busca||'%' or p.codigo ilike '%'||busca||'%')
     select jsonb_build_object('total',(select count(*) from lista),'pagina',pagina,'limite',limite,
       'dados',coalesce((select jsonb_agg(portal_acesso.perfil_json(x.id) order by x.codigo)
         from(select * from lista order by codigo limit limite offset (pagina-1)*limite) x),'[]'::jsonb))
       into resultado;
   elsif p_operacao='listar_auditoria' then
     select jsonb_build_object('total',(select count(*) from portal_acesso.auditoria),
       'pagina',pagina,'limite',limite,'dados',coalesce((select jsonb_agg(to_jsonb(x) order by x.ocorrido_em desc,x.id)
         from(select e.id,e.ocorrido_em,e.entidade,e.operacao,e.antes,e.depois,
           coalesce(u.email,'Manutencao administrativa') autor,
           (select u2.email from auth.users u2 where u2.id::text=coalesce(e.depois->>'user_id',e.antes->>'user_id',
             (select a2.user_id::text from portal_acesso.atribuicoes a2 where a2.id::text=coalesce(e.depois->>'atribuicao_id',e.antes->>'atribuicao_id')))) alvo
           from portal_acesso.auditoria e left join auth.users u on u.id=e.autor_id
           order by e.ocorrido_em desc,e.id limit limite offset (pagina-1)*limite) x),'[]'::jsonb))
       into resultado;
   else
     status_filtro:=coalesce(p_dados->>'status','TODOS');
     empresa_filtro:=coalesce(p_dados->>'empresa','TODAS');
     if status_filtro not in ('TODOS','PENDENTE','APROVADO','REJEITADO','CANCELADO') then
       raise exception using errcode='PT400',message='Status invalido.';
     end if;
     with lista as(select s.* from public.solicitacoes_acesso s
       where (status_filtro='TODOS' or s.status=status_filtro) and (empresa_filtro='TODAS' or s.empresa=empresa_filtro)
       and (s.email_corporativo ilike '%'||busca||'%' or s.nome_completo ilike '%'||busca||'%'
         or s.empresa ilike '%'||busca||'%' or s.cargo_funcao ilike '%'||busca||'%' or s.projeto_unidade ilike '%'||busca||'%'))
     select jsonb_build_object('total',(select count(*) from lista),'pagina',pagina,'limite',limite,
       'empresas',(select coalesce(jsonb_agg(e.empresa order by e.empresa),'[]'::jsonb) from(select distinct empresa from public.solicitacoes_acesso) e),
       'contagens',(select jsonb_build_object('pendentes',count(*) filter(where status='PENDENTE'),
         'aprovadas',count(*) filter(where status='APROVADO'),'rejeitadas',count(*) filter(where status='REJEITADO'),'total',count(*)) from public.solicitacoes_acesso),
       'dados',coalesce((select jsonb_agg(to_jsonb(x) order by x.criado_em desc,x.id)
         from(select * from lista order by criado_em desc,id limit limite offset (pagina-1)*limite) x),'[]'::jsonb))
       into resultado;
   end if;
   return resultado;
 end if;

 if p_operacao='listar_atribuicoes' then
   perform portal_acesso.validar_campos(p_dados,array['usuarioId']);
   alvo:=(p_dados->>'usuarioId')::uuid;
   if alvo is null then raise exception using errcode='PT400',message='Selecione uma conta.'; end if;
   return jsonb_build_object('dados',coalesce((select jsonb_agg(portal_acesso.atribuicao_json(a.id) order by a.id)
     from portal_acesso.atribuicoes a where a.user_id=alvo),'[]'::jsonb));
 end if;

 if p_operacao='salvar_usuario' then
   perform portal_acesso.validar_campos(p_dados,array['id','ativo','versao']);
   alvo:=(p_dados->>'id')::uuid;
   if alvo is null or jsonb_typeof(p_dados->'ativo') is distinct from 'boolean' then
     raise exception using errcode='PT400',message='Conta ou estado invalido.';
   end if;
   v_ativo:=(p_dados->>'ativo')::boolean;
   perform 1 from auth.users u where u.id=alvo and u.deleted_at is null
     and not coalesce(u.is_anonymous,false) and (not v_ativo or (u.email_confirmed_at is not null
       and not coalesce(u.banned_until>now(),false))) for share;
   if not found then raise exception using errcode='PT409',message='A conta deve existir, estar confirmada e apta para ativacao.'; end if;
   select md5(to_jsonb(i)::text) into versao from public.perfis_portal i where i.user_id=alvo for update;
   if found then
     if p_dados->>'versao' is distinct from versao then
       raise exception using errcode='PT409',message='O cadastro mudou. Atualize a tela antes de salvar.';
     end if;
     update public.perfis_portal set ativo=v_ativo,atualizado_em=clock_timestamp() where user_id=alvo;
   else
     if p_dados->>'versao' is not null then raise exception using errcode='PT409',message='O cadastro mudou. Atualize a tela.'; end if;
     insert into public.perfis_portal(user_id,papel,ativo) values(alvo,'USUARIO',v_ativo);
   end if;
   return jsonb_build_object('ok',true);
 elsif p_operacao='salvar_perfil' then
   perform portal_acesso.validar_campos(p_dados,array['id','codigo','nome','descricao','ativo','capacidades','versao']);
   alvo:=nullif(p_dados->>'id','')::uuid;
   if jsonb_typeof(p_dados->'ativo') is distinct from 'boolean'
      or jsonb_typeof(p_dados->'nome') is distinct from 'string'
      or length(btrim(p_dados->>'nome')) not between 1 and 150
      or length(coalesce(p_dados->>'descricao',''))>1000
      or jsonb_typeof(p_dados->'capacidades') is distinct from 'array'
      or jsonb_array_length(p_dados->'capacidades')>11 then
     raise exception using errcode='PT400',message='Revise o nome, estado e capacidades do perfil.';
   end if;
   for cap in select value from jsonb_array_elements(p_dados->'capacidades') loop
     perform portal_acesso.validar_campos(cap,array['modulo','acao']);
     if not portal_acesso.modulo_acao_valido(cap->>'modulo',cap->>'acao') then
       raise exception using errcode='PT400',message='Capacidade desconhecida.';
     end if;
   end loop;
   if (select count(distinct (x->>'modulo',x->>'acao')) from jsonb_array_elements(p_dados->'capacidades') x)
      <>jsonb_array_length(p_dados->'capacidades') then
     raise exception using errcode='PT400',message='Capacidades repetidas.';
   end if;
   if alvo is null then
     if jsonb_typeof(p_dados->'codigo') is distinct from 'string' or p_dados->>'codigo' !~ '^[a-z][a-z0-9_]{0,79}$'
        or p_dados->>'versao' is not null then
       raise exception using errcode='PT400',message='Codigo do perfil invalido.';
     end if;
     insert into portal_acesso.perfis(codigo,nome,descricao,ativo)
     values(p_dados->>'codigo',btrim(p_dados->>'nome'),coalesce(p_dados->>'descricao',''),(p_dados->>'ativo')::boolean)
     returning id into alvo;
   else
     select portal_acesso.perfil_json(p.id) into existente from portal_acesso.perfis p where p.id=alvo for update;
     if not found then raise exception using errcode='PT404',message='Perfil nao encontrado.'; end if;
     if p_dados->>'versao' is distinct from existente->>'versao'
        or p_dados->>'codigo' is distinct from existente->>'codigo' then
       raise exception using errcode='PT409',message='O perfil mudou. Atualize a tela antes de salvar.';
     end if;
     update portal_acesso.perfis set nome=btrim(p_dados->>'nome'),descricao=coalesce(p_dados->>'descricao',''),
       ativo=(p_dados->>'ativo')::boolean where id=alvo;
   end if;
   update portal_acesso.permissoes_perfil pp set ativo=false where pp.perfil_id=alvo and pp.ativo
     and not exists(select 1 from jsonb_array_elements(p_dados->'capacidades') c where c->>'modulo'=pp.modulo and c->>'acao'=pp.acao);
   for cap in select value from jsonb_array_elements(p_dados->'capacidades') loop
     insert into portal_acesso.permissoes_perfil as pp_nova(perfil_id,modulo,acao,ativo)
     values(alvo,cap->>'modulo',cap->>'acao',true)
     on conflict(perfil_id,modulo,acao) do update set ativo=true where not pp_nova.ativo;
   end loop;
   return jsonb_build_object('ok',true,'perfil',portal_acesso.perfil_json(alvo));
 elsif p_operacao in ('salvar_atribuicao','estado_atribuicao') then
   if p_operacao='estado_atribuicao' then
     perform portal_acesso.validar_campos(p_dados,array['id','ativo','versao']);
   else
     perform portal_acesso.validar_campos(p_dados,array['id','usuarioId','perfilId','ativo','inicio','fim','abrangencias','versao']);
   end if;
   if jsonb_typeof(p_dados->'ativo') is distinct from 'boolean' then
     raise exception using errcode='PT400',message='Estado invalido.';
   end if;
   v_ativo:=(p_dados->>'ativo')::boolean;
   alvo:=nullif(p_dados->>'id','')::uuid;
   if alvo is not null then
     select portal_acesso.atribuicao_json(a.id) into existente from portal_acesso.atribuicoes a where a.id=alvo for update;
     if not found then raise exception using errcode='PT404',message='Concessao nao encontrada.'; end if;
     if p_dados->>'versao' is distinct from existente->>'versao' then
       raise exception using errcode='PT409',message='A concessao mudou. Atualize a tela antes de salvar.';
     end if;
   elsif p_operacao='estado_atribuicao' or p_dados->>'versao' is not null then
     raise exception using errcode='PT400',message='Selecione a concessao.';
   end if;
   if p_operacao='estado_atribuicao' then
     update portal_acesso.atribuicoes set ativo=v_ativo where id=alvo;
     return jsonb_build_object('ok',true);
   end if;
   perfil:=(p_dados->>'perfilId')::uuid;
   if perfil is null or (p_dados->>'usuarioId')::uuid is null
      or jsonb_typeof(p_dados->'abrangencias') is distinct from 'array'
      or jsonb_array_length(p_dados->'abrangencias') not between 1 and 11 then
     raise exception using errcode='PT400',message='Selecione conta, perfil e abrangencias explicitas.';
   end if;
   if alvo is not null and (existente->>'user_id' is distinct from p_dados->>'usuarioId'
     or existente->>'perfil_id' is distinct from p_dados->>'perfilId') then
     raise exception using errcode='PT400',message='A conta e o perfil de uma concessao existente nao podem ser trocados.';
   end if;
   perform 1 from portal_acesso.perfis where id=perfil and portal_acesso.perfis.ativo for share;
   if not found then raise exception using errcode='PT409',message='O perfil deve estar ativo.'; end if;
   if exists(select 1 from (values('inicio'),('fim')) x(campo)
     where p_dados->x.campo is not null and p_dados->x.campo<>'null'::jsonb
     and (jsonb_typeof(p_dados->x.campo)<>'string'
       or p_dados->>x.campo !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$')) then
     raise exception using errcode='PT400',message='Informe datas UTC validas.';
   end if;
   v_inicio:=(p_dados->>'inicio')::timestamptz;
   v_fim:=(p_dados->>'fim')::timestamptz;
   if v_inicio is not null and v_fim is not null and v_inicio>=v_fim then
     raise exception using errcode='PT400',message='O vencimento deve ser posterior ao inicio.';
   end if;
   if alvo is null then
     insert into portal_acesso.atribuicoes(user_id,perfil_id,ativo,inicio,fim)
     values((p_dados->>'usuarioId')::uuid,perfil,v_ativo,v_inicio,v_fim) returning id into alvo;
   else
     update portal_acesso.atribuicoes set ativo=v_ativo,inicio=v_inicio,fim=v_fim where id=alvo;
     delete from portal_acesso.abrangencias where atribuicao_id=alvo;
   end if;
   for item in select value from jsonb_array_elements(p_dados->'abrangencias') loop
     perform portal_acesso.validar_campos(item,array['modulo','acao','tipo','unidades']);
     perform 1 from portal_acesso.permissoes_perfil pp where pp.perfil_id=perfil and pp.ativo
       and pp.modulo=item->>'modulo' and pp.acao=item->>'acao';
     if not found or not portal_acesso.abrangencia_valida(item->>'modulo',item->>'tipo',item->'unidades') then
       raise exception using errcode='PT400',message='Abrangencia vazia, invalida ou fora das capacidades ativas do perfil.';
     end if;
     insert into portal_acesso.abrangencias(atribuicao_id,perfil_id,modulo,acao,tipo,unidades)
     values(alvo,perfil,item->>'modulo',item->>'acao',item->>'tipo',item->'unidades');
   end loop;
   return jsonb_build_object('ok',true,'atribuicao',portal_acesso.atribuicao_json(alvo));
 elsif p_operacao='analisar_solicitacao' then
   perform portal_acesso.validar_campos(p_dados,array['id','acao','observacao']);
   alvo:=(p_dados->>'id')::uuid;
   if alvo is null or p_dados->>'acao' not in ('APROVAR','REJEITAR')
      or p_dados->>'acao' is null or length(coalesce(p_dados->>'observacao',''))>2000 then
     raise exception using errcode='PT400',message='Acao ou observacao invalida.';
   end if;
   update public.solicitacoes_acesso set status=case p_dados->>'acao' when 'APROVAR' then 'APROVADO' else 'REJEITADO' end,
     analisado_em=clock_timestamp(),analisado_por=ator,observacao_analise=nullif(btrim(p_dados->>'observacao'),''),
     atualizado_em=clock_timestamp() where id=alvo and status='PENDENTE' returning to_jsonb(solicitacoes_acesso.*) into linha;
   if not found then raise exception using errcode='PT409',message='A solicitacao nao existe ou ja foi analisada.'; end if;
   insert into portal_acesso.auditoria(autor_id,sessao_banco,papel_sessao,entidade,operacao,antes,depois)
   values(ator,session_user,current_setting('role',true),'public.solicitacoes_acesso','UPDATE',
     jsonb_build_object('id',alvo,'status','PENDENTE'),
     jsonb_build_object('id',alvo,'status',linha->>'status','analisado_por',ator));
   return jsonb_build_object('ok',true,'solicitacao',linha);
 end if;
 raise exception using errcode='PT400',message='Operacao desconhecida.';
end;
$$;

create function public.gerir_acessos_portal(p_operacao text,p_dados jsonb default '{}'::jsonb)
returns jsonb language sql security invoker set search_path = '' as $$
 select portal_acesso.executar_gestao(p_operacao,p_dados);
$$;

revoke all on function portal_acesso.tem_gestao(uuid,text,boolean) from public,anon,authenticated,service_role;
revoke all on function portal_acesso.ha_administrador_permanente() from public,anon,authenticated,service_role;
revoke all on function portal_acesso.serializar_gestao() from public,anon,authenticated,service_role;
revoke all on function portal_acesso.preservar_administrador() from public,anon,authenticated,service_role;
revoke all on function portal_acesso.perfil_json(uuid) from public,anon,authenticated,service_role;
revoke all on function portal_acesso.atribuicao_json(uuid) from public,anon,authenticated,service_role;
revoke all on function portal_acesso.validar_campos(jsonb,text[]) from public,anon,authenticated,service_role;
revoke all on function portal_acesso.executar_gestao(text,jsonb) from public,anon,authenticated,service_role;
revoke all on function public.gerir_acessos_portal(text,jsonb) from public,anon,authenticated,service_role;
grant execute on function portal_acesso.executar_gestao(text,jsonb) to authenticated;
grant execute on function public.gerir_acessos_portal(text,jsonb) to authenticated;
commit;
