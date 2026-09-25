-- =========================================================
-- BUFFER E PROMOCAO ATOMICA - MART AVCB
-- =========================================================


-- =========================================================
-- 1. BUFFER TEMPORARIO DA CAMADA OURO
-- =========================================================

create table if not exists public.stg_mart_avcb (

    carga_id uuid not null,
    linha_id integer not null,

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
    data_atualizacao date not null,

    carregado_em timestamptz
        not null
        default now(),

    constraint pk_stg_mart_avcb
        primary key (
            carga_id,
            linha_id
        ),

    constraint chk_stg_mart_avcb_linha_id
        check (
            linha_id > 0
        )
);


-- =========================================================
-- 2. ROW LEVEL SECURITY
-- =========================================================

alter table public.stg_mart_avcb
enable row level security;


-- =========================================================
-- 3. SEGURANCA DAS TABELAS
-- =========================================================

revoke all
on table public.stg_mart_avcb
from anon, authenticated;

grant select, insert, delete
on table public.stg_mart_avcb
to service_role;

revoke update, truncate
on table public.stg_mart_avcb
from service_role;


revoke insert, update, delete, truncate
on table public.mart_avcb
from service_role;

grant select
on table public.mart_avcb
to service_role;


-- =========================================================
-- 4. PROMOCAO ATOMICA
-- =========================================================

create or replace function
public.promover_mart_avcb(
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
        p_quantidade_esperada is null
        or p_quantidade_esperada <= 0
    ) then

        raise exception
            'quantidade esperada invalida: %',
            p_quantidade_esperada;

    end if;


    select count(*)
    into v_staging
    from public.stg_mart_avcb
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


    lock table
        public.mart_avcb
    in exclusive mode;


    delete
    from public.mart_avcb
    where projeto is not null;


    insert into public.mart_avcb (

        projeto,
        subestacao,
        localidade,
        estado,
        responsavel,
        empresa,
        instalacao,
        gestao_avcb,
        responsabilidade_avcb,
        situacao,
        projeto_incendio,
        alvara_bombeiros,
        sdai,
        brigada_incendio,
        validade_avcb_uf_anos,
        vigencia_alvara,
        dias_para_vencer,
        status_validade,
        status_gestao,
        data_atualizacao

    )

    select

        projeto,
        subestacao,
        localidade,
        estado,
        responsavel,
        empresa,
        instalacao,
        gestao_avcb,
        responsabilidade_avcb,
        situacao,
        projeto_incendio,
        alvara_bombeiros,
        sdai,
        brigada_incendio,
        validade_avcb_uf_anos,
        vigencia_alvara,
        dias_para_vencer,
        status_validade,
        status_gestao,
        data_atualizacao

    from public.stg_mart_avcb

    where carga_id = p_carga_id

    order by linha_id;


    select count(*)
    into v_publicado
    from public.mart_avcb;


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
-- 5. SEGURANCA DA RPC
-- =========================================================

revoke all
on function public.promover_mart_avcb(
    uuid,
    integer
)
from public, anon, authenticated;


grant execute
on function public.promover_mart_avcb(
    uuid,
    integer
)
to service_role;
