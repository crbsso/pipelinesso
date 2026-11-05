-- Snapshot mensal da Manutenção. Dados independentes do Prevsys.
create table public.mart_painel_manutencao (
  competencia date primary key check (extract(day from competencia) = 1),
  carga_id uuid not null,
  extraido_em timestamptz not null,
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  conteudo jsonb not null,
  publicado_em timestamptz not null default now(),
  check ((jsonb_typeof(conteudo) = 'object' and conteudo->>'versao' = '1'
    and conteudo->>'origem' = 'SQL Server Intranet'
    and jsonb_typeof(conteudo->'dados') = 'array'
    and jsonb_typeof(conteudo->'atividades') = 'array'
    and jsonb_typeof(conteudo->'programacao'->'ordens') = 'array'
    and jsonb_typeof(conteudo->'programacao'->'vinculos') = 'array'
    and conteudo->'programacao'->>'inicio' = competencia::text) is true)
);
alter table public.mart_painel_manutencao enable row level security;
revoke all on public.mart_painel_manutencao from public, anon, authenticated;
grant select, insert, update on public.mart_painel_manutencao to service_role;
comment on table public.mart_painel_manutencao is
 'Snapshots mensais completos de formulários e atividades do SQL Server; leitura somente pelo servidor autorizado.';

create function public.publicar_painel_manutencao(p_cargas jsonb)
returns integer language plpgsql security invoker set search_path = '' as $fn$
declare esperadas integer; gravadas integer;
begin
  if jsonb_typeof(p_cargas) is distinct from 'array' then
    raise exception 'Cargas devem ser uma lista';
  end if;
  esperadas := jsonb_array_length(p_cargas);
  if esperadas < 1 or esperadas > 12 then raise exception 'Quantidade de meses inválida'; end if;
  if (select count(distinct c->>'competencia') from jsonb_array_elements(p_cargas) c) <> esperadas then
    raise exception 'Competência duplicada';
  end if;
  insert into public.mart_painel_manutencao as destino
    (competencia, carga_id, extraido_em, sha256, conteudo)
  select competencia, carga_id, extraido_em, sha256, conteudo
  from jsonb_to_recordset(p_cargas) as x(
    competencia date, carga_id uuid, extraido_em timestamptz, sha256 text, conteudo jsonb)
  on conflict (competencia) do update set
    carga_id = excluded.carga_id, extraido_em = excluded.extraido_em,
    sha256 = excluded.sha256, conteudo = excluded.conteudo, publicado_em = now()
  where destino.extraido_em <= excluded.extraido_em;
  get diagnostics gravadas = row_count;
  if gravadas <> esperadas then raise exception 'Carga mais antiga que a publicação atual'; end if;
  return gravadas;
end;
$fn$;
revoke all on function public.publicar_painel_manutencao(jsonb) from public, anon, authenticated;
grant execute on function public.publicar_painel_manutencao(jsonb) to service_role;
