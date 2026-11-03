-- Preparacao de identidade/solicitacoes; sem bootstrap de administrador.
-- Arquivo preparado para revisao. Nao executar db push com o historico inteiro.
begin;

create table if not exists public.solicitacoes_acesso (
  id uuid primary key default gen_random_uuid(),
  nome_completo text not null,
  email_corporativo text not null,
  empresa text not null,
  cargo_funcao text not null,
  projeto_unidade text not null,
  justificativa text not null,
  status text not null default 'PENDENTE'
    check (status in ('PENDENTE', 'APROVADO', 'REJEITADO', 'CANCELADO')),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
alter table public.solicitacoes_acesso
  add column if not exists analisado_em timestamptz,
  add column if not exists analisado_por uuid references auth.users(id) on delete set null,
  add column if not exists observacao_analise text;
create unique index if not exists uq_solicitacoes_acesso_email_pendente
  on public.solicitacoes_acesso (lower(email_corporativo)) where status = 'PENDENTE';
create index if not exists idx_solicitacoes_acesso_status on public.solicitacoes_acesso(status);
create index if not exists idx_solicitacoes_acesso_criado_em on public.solicitacoes_acesso(criado_em desc);
create index if not exists idx_solicitacoes_acesso_analisado_por on public.solicitacoes_acesso(analisado_por);

create table if not exists public.perfis_portal (
  user_id uuid primary key references auth.users(id) on delete cascade,
  papel text not null default 'USUARIO' check (papel in ('ADMIN_SSO', 'USUARIO')),
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists idx_perfis_portal_papel on public.perfis_portal(papel);

alter table public.solicitacoes_acesso enable row level security;
alter table public.perfis_portal enable row level security;
revoke all on public.solicitacoes_acesso, public.perfis_portal from public, anon, authenticated, service_role;
grant select, insert, update on public.solicitacoes_acesso, public.perfis_portal to service_role;

-- Preserva linhas existentes; nao escolhe contas por email nem concede ADMIN_SSO.
commit;
