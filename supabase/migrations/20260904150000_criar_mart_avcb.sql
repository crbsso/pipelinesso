-- =========================================================
-- PIPELINE SSO
-- MIGRATION 001
-- MART AVCB
-- =========================================================


-- =========================================================
-- 1. CRIA TABELA
-- =========================================================

create table if not exists public.mart_avcb (

    projeto text not null,
    subestacao text not null,
    localidade text not null,
    estado text not null,
    responsavel text not null,
    empresa text not null,

    instalacao text not null,
    gestao_avcb text not null,
    responsabilidade_avcb text not null,

    situacao text not null,
    projeto_incendio text not null,
    alvara_bombeiros text not null,
    sdai text not null,
    brigada_incendio text not null,

    validade_avcb_uf_anos integer not null,

    vigencia_alvara date not null,
    dias_para_vencer integer not null,
    status_validade text not null,

    status_gestao text not null,
    data_atualizacao date not null

);


-- =========================================================
-- 2. ÍNDICES
-- =========================================================

create index if not exists idx_mart_avcb_projeto
on public.mart_avcb(projeto);

create index if not exists idx_mart_avcb_estado
on public.mart_avcb(estado);

create index if not exists idx_mart_avcb_responsavel
on public.mart_avcb(responsavel);

create index if not exists idx_mart_avcb_gestao
on public.mart_avcb(gestao_avcb);

create index if not exists idx_mart_avcb_responsabilidade
on public.mart_avcb(responsabilidade_avcb);

create index if not exists idx_mart_avcb_status_validade
on public.mart_avcb(status_validade);

create index if not exists idx_mart_avcb_status_gestao
on public.mart_avcb(status_gestao);

create index if not exists idx_mart_avcb_vigencia
on public.mart_avcb(vigencia_alvara);


-- =========================================================
-- 3. ROW LEVEL SECURITY
-- =========================================================

alter table public.mart_avcb
enable row level security;


-- =========================================================
-- 4. SEGURANÇA INICIAL
-- =========================================================

revoke all
on table public.mart_avcb
from anon, authenticated;