-- =========================================================
-- PIPELINE SSO
-- MART INSPECOES
--
-- Fluxo:
--   1. Python carrega STAGING com carga_id
--   2. Python valida STAGING remotamente
--   3. RPC promove a carga de forma atomica
--   4. Python valida MART oficial
--   5. Python remove a carga da STAGING
-- =========================================================


-- =========================================================
-- 1. MART OFICIAL
-- =========================================================

create table if not exists public.mart_inspecoes (

    id_resposta bigint primary key,

    nome_formulario text not null,
    contrato text,

    data_inspecao date not null,

    area_organizacional text not null,
    local text not null,

    empresa_inspecao text,

    estado_plano_acao text not null,

    acoes_corretivas_atrasadas integer
        not null
        default 0,

    cod_colaborador text,

    status_vinculo_colaborador text
        not null,

    nome_exibicao text
        not null,

    cargo_colaborador text,
    setor_colaborador text,
    empresa_colaborador text,

    data_atualizacao timestamp
        without time zone
        not null,

    constraint chk_mart_inspecoes_acoes
        check (
            acoes_corretivas_atrasadas >= 0
        ),

    constraint chk_mart_inspecoes_status
        check (
            status_vinculo_colaborador
            in (
                'VINCULADO',
                'NAO_VINCULADO'
            )
        ),

    constraint chk_mart_inspecoes_textos
        check (
            btrim(nome_formulario) <> ''
            and btrim(area_organizacional) <> ''
            and btrim(local) <> ''
            and btrim(estado_plano_acao) <> ''
            and btrim(nome_exibicao) <> ''
        ),

    constraint chk_mart_inspecoes_vinculo
        check (
            (
                status_vinculo_colaborador
                    = 'VINCULADO'

                and cod_colaborador
                    is not null

                and cod_colaborador
                    ~ '^[0-9]+-[0-9]+$'

                and cargo_colaborador
                    is not null

                and setor_colaborador
                    is not null

                and empresa_colaborador
                    is not null

                and nome_exibicao
                    <> 'Nao vinculado'
            )
            or
            (
                status_vinculo_colaborador
                    = 'NAO_VINCULADO'

                and cod_colaborador
                    is null

                and cargo_colaborador
                    is null

                and setor_colaborador
                    is null

                and empresa_colaborador
                    is null

                and nome_exibicao
                    = 'Nao vinculado'
            )
        )

);


-- =========================================================
-- 2. STAGING
-- =========================================================

create table if not exists public.stg_mart_inspecoes (

    carga_id uuid not null,

    id_resposta bigint not null,

    nome_formulario text not null,
    contrato text,

    data_inspecao date not null,

    area_organizacional text not null,
    local text not null,

    empresa_inspecao text,

    estado_plano_acao text not null,

    acoes_corretivas_atrasadas integer
        not null
        default 0,

    cod_colaborador text,

    status_vinculo_colaborador text
        not null,

    nome_exibicao text
        not null,

    cargo_colaborador text,
    setor_colaborador text,
    empresa_colaborador text,

    data_atualizacao timestamp
        without time zone
        not null,

    carregado_em timestamptz
        not null
        default now(),

    primary key (
        carga_id,
        id_resposta
    ),

    constraint chk_stg_mart_inspecoes_acoes
        check (
            acoes_corretivas_atrasadas >= 0
        ),

    constraint chk_stg_mart_inspecoes_status
        check (
            status_vinculo_colaborador
            in (
                'VINCULADO',
                'NAO_VINCULADO'
            )
        ),

    constraint chk_stg_mart_inspecoes_textos
        check (
            btrim(nome_formulario) <> ''
            and btrim(area_organizacional) <> ''
            and btrim(local) <> ''
            and btrim(estado_plano_acao) <> ''
            and btrim(nome_exibicao) <> ''
        ),

    constraint chk_stg_mart_inspecoes_vinculo
        check (
            (
                status_vinculo_colaborador
                    = 'VINCULADO'

                and cod_colaborador
                    is not null

                and cod_colaborador
                    ~ '^[0-9]+-[0-9]+$'

                and cargo_colaborador
                    is not null

                and setor_colaborador
                    is not null

                and empresa_colaborador
                    is not null

                and nome_exibicao
                    <> 'Nao vinculado'
            )
            or
            (
                status_vinculo_colaborador
                    = 'NAO_VINCULADO'

                and cod_colaborador
                    is null

                and cargo_colaborador
                    is null

                and setor_colaborador
                    is null

                and empresa_colaborador
                    is null

                and nome_exibicao
                    = 'Nao vinculado'
            )
        )

);


-- =========================================================
-- 3. INDICES DA MART
-- =========================================================

create index if not exists
idx_mart_inspecoes_data
on public.mart_inspecoes(
    data_inspecao
);

create index if not exists
idx_mart_inspecoes_area
on public.mart_inspecoes(
    area_organizacional
);

create index if not exists
idx_mart_inspecoes_plano
on public.mart_inspecoes(
    estado_plano_acao
);

create index if not exists
idx_mart_inspecoes_colaborador
on public.mart_inspecoes(
    cod_colaborador
);

create index if not exists
idx_mart_inspecoes_empresa_colaborador
on public.mart_inspecoes(
    empresa_colaborador
);


-- =========================================================
-- 4. RLS
-- =========================================================

alter table public.mart_inspecoes
enable row level security;

alter table public.stg_mart_inspecoes
enable row level security;


-- =========================================================
-- 5. PERMISSOES
-- =========================================================

revoke all
on table public.mart_inspecoes
from anon, authenticated;

revoke all
on table public.stg_mart_inspecoes
from anon, authenticated;


-- O publicador pode ler a MART oficial,
-- mas nao deve altera-la diretamente.

revoke insert, update, delete, truncate
on table public.mart_inspecoes
from service_role;

grant select
on table public.mart_inspecoes
to service_role;


-- A STAGING pode ser carregada,
-- validada e limpa pelo publicador.

grant select, insert, delete
on table public.stg_mart_inspecoes
to service_role;

revoke update, truncate
on table public.stg_mart_inspecoes
from service_role;


-- =========================================================
-- 6. PROMOCAO ATOMICA
-- =========================================================

create or replace function
public.promover_mart_inspecoes(
    p_carga_id uuid,
    p_quantidade_esperada integer
)
returns integer

language plpgsql

security definer

set search_path =
    pg_catalog,
    public

as $$

declare

    v_staging integer;

    v_publicado integer;

begin

    if p_carga_id is null then

        raise exception
            'carga_id nao pode ser nulo.';

    end if;


    if (
        p_quantidade_esperada
        is null
        or p_quantidade_esperada <= 0
    ) then

        raise exception
            'quantidade esperada invalida: %',
            p_quantidade_esperada;

    end if;


    select count(*)
    into v_staging
    from public.stg_mart_inspecoes
    where carga_id = p_carga_id;


    if v_staging = 0 then

        raise exception
            'Nenhum registro encontrado '
            'na staging para carga_id %.',
            p_carga_id;

    end if;


    if (
        v_staging
        <> p_quantidade_esperada
    ) then

        raise exception
            'Quantidade da staging (%) '
            'difere da esperada (%).',
            v_staging,
            p_quantidade_esperada;

    end if;


    -- Impede duas promocoes simultaneas
    -- da mesma MART.

    lock table
        public.mart_inspecoes
    in exclusive mode;


    delete
    from public.mart_inspecoes;


    insert into public.mart_inspecoes (

        id_resposta,
        nome_formulario,
        contrato,
        data_inspecao,
        area_organizacional,
        local,
        empresa_inspecao,
        estado_plano_acao,
        acoes_corretivas_atrasadas,
        cod_colaborador,
        status_vinculo_colaborador,
        nome_exibicao,
        cargo_colaborador,
        setor_colaborador,
        empresa_colaborador,
        data_atualizacao

    )

    select

        id_resposta,
        nome_formulario,
        contrato,
        data_inspecao,
        area_organizacional,
        local,
        empresa_inspecao,
        estado_plano_acao,
        acoes_corretivas_atrasadas,
        cod_colaborador,
        status_vinculo_colaborador,
        nome_exibicao,
        cargo_colaborador,
        setor_colaborador,
        empresa_colaborador,
        data_atualizacao

    from public.stg_mart_inspecoes

    where carga_id = p_carga_id;


    select count(*)
    into v_publicado
    from public.mart_inspecoes;


    if (
        v_publicado
        <> p_quantidade_esperada
    ) then

        raise exception
            'Quantidade publicada (%) '
            'difere da esperada (%).',
            v_publicado,
            p_quantidade_esperada;

    end if;


    return v_publicado;

end;

$$;


-- =========================================================
-- 7. SEGURANCA DA RPC
-- =========================================================

revoke all
on function public.promover_mart_inspecoes(
    uuid,
    integer
)
from public, anon, authenticated;

grant execute
on function public.promover_mart_inspecoes(
    uuid,
    integer
)
to service_role;
