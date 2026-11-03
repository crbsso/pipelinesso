-- Modelo de concessoes. Sem acesso novo aos marts e sem provisionamento de contas.
begin;
-- Falhar se o schema ja existir evita alterar objetos desconhecidos.
create schema portal_acesso;
revoke all on schema portal_acesso from public, anon, authenticated, service_role;

create function portal_acesso.modulo_acao_valido(p_modulo text, p_acao text)
returns boolean language sql immutable security invoker set search_path = ''
as $$
  select coalesce(
    (p_acao = 'consultar' and p_modulo in (
      'avcb','inspecoes','planos_acao','acoes_corretivas','motoristas',
      'motoristas_historico','motoristas_direcao','motoristas_velocidade'))
    or (p_acao = 'gerenciar' and p_modulo in ('solicitacoes_acesso','usuarios','permissoes')),
    false);
$$;

create function portal_acesso.abrangencia_valida(p_modulo text, p_tipo text, p_unidades jsonb)
returns boolean language plpgsql immutable security invoker set search_path = ''
as $$
declare
  campos text[];
  unidade jsonb;
  campo text;
begin
  if p_unidades is null or jsonb_typeof(p_unidades) <> 'array' then return false; end if;
  if p_tipo = 'corporativa' then return jsonb_array_length(p_unidades) = 0; end if;
  if p_tipo is distinct from 'restrita' or jsonb_array_length(p_unidades) not between 1 and 1000 then return false; end if;
  campos := case p_modulo
    when 'avcb' then array['projeto','subestacao','instalacao']
    when 'inspecoes' then array['area_organizacional','local','empresa_colaborador','setor_colaborador']
    when 'planos_acao' then array['nivel_organizacional','grupo_sso']
    when 'acoes_corretivas' then array['nivel_organizacional','grupo_sso']
    when 'motoristas' then array['coligada','secao_rm']
    when 'motoristas_historico' then array['coligada','secao_rm']
    when 'motoristas_direcao' then array['coligada','secao_rm']
    when 'motoristas_velocidade' then array['coligada','secao_rm']
    else array[]::text[] end;
  for unidade in select value from jsonb_array_elements(p_unidades) loop
    if jsonb_typeof(unidade) <> 'object' or unidade = '{}'::jsonb then return false; end if;
    if unidade ? 'secao_rm' and not (unidade ? 'coligada') then return false; end if;
    for campo in select jsonb_object_keys(unidade) loop
      if not (campo = any(campos)) or jsonb_typeof(unidade -> campo) <> 'string'
         or length(btrim(unidade ->> campo)) = 0 then return false; end if;
    end loop;
  end loop;
  return true;
end;
$$;

create table portal_acesso.perfis (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique check (codigo ~ '^[a-z][a-z0-9_]{0,79}$'),
  nome text not null check (length(btrim(nome)) between 1 and 150),
  descricao text not null default '',
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create table portal_acesso.permissoes_perfil (
  id uuid primary key default gen_random_uuid(),
  perfil_id uuid not null references portal_acesso.perfis(id) on delete restrict,
  modulo text not null,
  acao text not null,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique(perfil_id, modulo, acao),
  check (portal_acesso.modulo_acao_valido(modulo, acao))
);
create table portal_acesso.atribuicoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.perfis_portal(user_id) on delete restrict,
  perfil_id uuid not null references portal_acesso.perfis(id) on delete restrict,
  ativo boolean not null default true,
  inicio timestamptz,
  fim timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique(user_id, perfil_id),
  unique(id, perfil_id),
  check ((inicio is null or isfinite(inicio)) and (fim is null or isfinite(fim))),
  check (inicio is null or fim is null or inicio < fim)
);
create table portal_acesso.abrangencias (
  id uuid primary key default gen_random_uuid(),
  atribuicao_id uuid not null,
  perfil_id uuid not null,
  modulo text not null,
  acao text not null,
  tipo text not null check (tipo in ('corporativa','restrita')),
  unidades jsonb not null default '[]'::jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique(atribuicao_id, modulo, acao),
  foreign key (atribuicao_id, perfil_id) references portal_acesso.atribuicoes(id, perfil_id) on delete restrict,
  foreign key (perfil_id, modulo, acao) references portal_acesso.permissoes_perfil(perfil_id, modulo, acao) on delete restrict,
  check (portal_acesso.abrangencia_valida(modulo, tipo, unidades))
);
create table portal_acesso.auditoria (
  id uuid primary key default gen_random_uuid(),
  ocorrido_em timestamptz not null default clock_timestamp(),
  autor_id uuid, -- sem FK: preservar identidade historica mesmo apos remocao da conta
  sessao_banco text not null,
  papel_sessao text,
  entidade text not null,
  operacao text not null check (operacao in ('INSERT','UPDATE','DELETE')),
  antes jsonb,
  depois jsonb,
  transacao bigint not null default txid_current()
);
create index idx_portal_acesso_auditoria_tempo on portal_acesso.auditoria(ocorrido_em desc);
create index idx_portal_acesso_abrangencias_permissao on portal_acesso.abrangencias(perfil_id, modulo, acao);
create index idx_portal_acesso_atribuicoes_perfil on portal_acesso.atribuicoes(perfil_id);

alter table portal_acesso.perfis enable row level security;
alter table portal_acesso.permissoes_perfil enable row level security;
alter table portal_acesso.atribuicoes enable row level security;
alter table portal_acesso.abrangencias enable row level security;
alter table portal_acesso.auditoria enable row level security;
revoke all on all tables in schema portal_acesso from public, anon, authenticated, service_role;

create function portal_acesso.atualizar_instante()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  new.atualizado_em := clock_timestamp();
  return new;
end;
$$;

-- SECURITY DEFINER somente para gravacao pelo trigger; EXECUTE direto e revogado.
-- auth.uid() identifica a pessoa quando ha JWT. Manutencao SQL sem JWT fica
-- explicitamente sem autor_id, identificada pela sessao do banco, sem inventar autoria.
create function portal_acesso.registrar_auditoria()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into portal_acesso.auditoria(autor_id, sessao_banco, papel_sessao, entidade, operacao, antes, depois)
  values (auth.uid(), session_user, current_setting('role', true),
    tg_table_schema || '.' || tg_table_name, tg_op,
    case when tg_op = 'INSERT' then null else to_jsonb(old) end,
    case when tg_op = 'DELETE' then null else to_jsonb(new) end);
  return null;
end;
$$;

create trigger portal_perfis_instante before update on portal_acesso.perfis
for each row execute function portal_acesso.atualizar_instante();
create trigger portal_permissoes_instante before update on portal_acesso.permissoes_perfil
for each row execute function portal_acesso.atualizar_instante();
create trigger portal_atribuicoes_instante before update on portal_acesso.atribuicoes
for each row execute function portal_acesso.atualizar_instante();
create trigger portal_abrangencias_instante before update on portal_acesso.abrangencias
for each row execute function portal_acesso.atualizar_instante();
create trigger portal_identidade_auditoria after insert or update or delete on public.perfis_portal
for each row execute function portal_acesso.registrar_auditoria();
create trigger portal_perfis_auditoria after insert or update or delete on portal_acesso.perfis
for each row execute function portal_acesso.registrar_auditoria();
create trigger portal_permissoes_auditoria after insert or update or delete on portal_acesso.permissoes_perfil
for each row execute function portal_acesso.registrar_auditoria();
create trigger portal_atribuicoes_auditoria after insert or update or delete on portal_acesso.atribuicoes
for each row execute function portal_acesso.registrar_auditoria();
create trigger portal_abrangencias_auditoria after insert or update or delete on portal_acesso.abrangencias
for each row execute function portal_acesso.registrar_auditoria();

-- Leitura mediada indispensavel porque as tabelas internas nao sao expostas.
-- Sem parametro user_id: a identidade vem exclusivamente da sessao autenticada.
create function portal_acesso.obter_contexto_proprio()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  usuario uuid := auth.uid();
  usuario_ativo boolean;
  perfis jsonb;
begin
  if usuario is null then raise exception using errcode = '42501', message = 'Sessao autenticada obrigatoria.'; end if;
  select p.ativo into usuario_ativo from public.perfis_portal p where p.user_id = usuario;
  if usuario_ativo is distinct from true then
    return jsonb_build_object('usuarioId', usuario::text, 'ativo', false, 'perfis', '[]'::jsonb);
  end if;
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
    'perfil', p.codigo, 'ativo', a.ativo and p.ativo,
    'inicio', to_char(a.inicio at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'fim', to_char(a.fim at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'concessoes', coalesce((select jsonb_agg(jsonb_build_object(
      'modulo', b.modulo, 'acoes', jsonb_build_array(b.acao),
      'abrangencia', case when b.tipo = 'corporativa' then jsonb_build_object('tipo', b.tipo)
        else jsonb_build_object('tipo', b.tipo, 'unidades', b.unidades) end
    ) order by b.modulo, b.acao)
    from portal_acesso.abrangencias b join portal_acesso.permissoes_perfil pp
      on pp.perfil_id = b.perfil_id and pp.modulo = b.modulo and pp.acao = b.acao and pp.ativo
    where b.atribuicao_id = a.id and b.perfil_id = a.perfil_id), '[]'::jsonb)
  )) order by p.codigo, a.id), '[]'::jsonb)
  into perfis from portal_acesso.atribuicoes a
  join portal_acesso.perfis p on p.id = a.perfil_id where a.user_id = usuario;
  return jsonb_build_object('usuarioId', usuario::text, 'ativo', true, 'perfis', perfis);
end;
$$;

-- Wrapper sem elevacao de privilegios. A funcao privilegiada permanece interna.
create function public.obter_contexto_acesso_portal()
returns jsonb language sql stable security invoker set search_path = '' as $$
  select portal_acesso.obter_contexto_proprio();
$$;

revoke all on all functions in schema portal_acesso from public, anon, authenticated, service_role;
revoke all on function public.obter_contexto_acesso_portal() from public, anon, authenticated, service_role;
grant usage on schema portal_acesso to authenticated;
grant execute on function portal_acesso.obter_contexto_proprio() to authenticated;
grant execute on function public.obter_contexto_acesso_portal() to authenticated;

-- Nenhum perfil, atribuicao ou abrangencia e preenchido automaticamente.
-- Nenhuma politica/grant dos marts, view operacional ou funcao ETL e alterada.
commit;
