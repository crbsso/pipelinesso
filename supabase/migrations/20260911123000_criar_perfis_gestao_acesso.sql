create table if not exists public.perfis_portal (
  user_id uuid primary key references auth.users(id) on delete cascade,
  papel text not null default 'USUARIO'
    check (papel in ('ADMIN_SSO', 'USUARIO')),
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists idx_perfis_portal_papel
  on public.perfis_portal (papel);

alter table public.perfis_portal enable row level security;

revoke all on table public.perfis_portal from anon, authenticated;

insert into public.perfis_portal (
  user_id,
  papel,
  ativo
)
select
  id,
  'ADMIN_SSO',
  true
from auth.users
where lower(email) = 'seguranca@celeogroup.com'
on conflict (user_id)
do update set
  papel = excluded.papel,
  ativo = excluded.ativo,
  atualizado_em = now();

alter table public.solicitacoes_acesso
  add column if not exists analisado_em timestamptz,
  add column if not exists analisado_por uuid references auth.users(id) on delete set null,
  add column if not exists observacao_analise text;

create index if not exists idx_solicitacoes_acesso_analisado_por
  on public.solicitacoes_acesso (analisado_por);