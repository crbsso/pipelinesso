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

create unique index if not exists uq_solicitacoes_acesso_email_pendente
  on public.solicitacoes_acesso ((lower(email_corporativo)))
  where status = 'PENDENTE';

create index if not exists idx_solicitacoes_acesso_status
  on public.solicitacoes_acesso (status);

create index if not exists idx_solicitacoes_acesso_criado_em
  on public.solicitacoes_acesso (criado_em desc);

alter table public.solicitacoes_acesso enable row level security;

revoke all on table public.solicitacoes_acesso from anon, authenticated;
