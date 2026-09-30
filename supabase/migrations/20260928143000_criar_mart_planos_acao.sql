begin;


-- =========================================================
-- PORTAL SSO
-- MART PLANOS DE ACAO
--
-- Fluxo:
--   1. Python carrega STAGING com carga_id
--   2. Python valida STAGING remotamente
--   3. RPC promove a carga de forma atomica
--   4. Python valida MART oficial
--   5. Python limpa a STAGING
-- =========================================================


-- =========================================================
-- 1. MART OFICIAL
-- =========================================================

create table if not exists public.mart_planos_acao (

    plano_id text primary key,

    id_resposta bigint,

    nome_plano text,
    modulo_origem text,

    inicio_plano date,
    criacao_plano date,
    cronograma_plano date,
    encerramento_plano date,

    nivel_organizacional text,
    divisao_plano text not null,

    estado_plano_fonte text not null,

    flag_ativo_fonte smallint not null,
    flag_aberto_fonte smallint not null,
    flag_atrasado_fonte smallint not null,
    flag_fechado_fonte smallint not null,
    flag_fechado_apos_prazo_fonte smallint not null,

    data_referencia date not null,

    dias_para_prazo integer,
    dias_em_atraso_calculado integer,

    situacao_prazo_calculada text not null,

    flag_vencido_calculado smallint not null,
    flag_em_prazo_calculado smallint not null,
    flag_vence_hoje smallint not null,

    divergencia_status_prazo smallint not null,

    criador_plano text,
    criador_plano_variantes text,

    status_criador text not null,

    gestor_plano text,

    grupo_sso text not null,
    metodo_classificacao text not null,

    descricao_plano text,
    contrato_plano text,

    registros_origem integer not null,
    duplicado_origem text not null,


    constraint chk_mart_planos_acao_grupo
        check (
            grupo_sso in (
                'SEGURANCA',
                'OUTRAS_AREAS'
            )
        ),


    constraint chk_mart_planos_acao_metodo
        check (
            metodo_classificacao in (
                'NIVEL_ORGANIZACIONAL',
                'MAPA_GESTOR',
                'PADRAO'
            )
        ),


    constraint chk_mart_planos_acao_situacao
        check (
            situacao_prazo_calculada in (
                'EM_PRAZO',
                'VENCIDO',
                'VENCE_HOJE',
                'SEM_PRAZO',
                'NAO_APLICAVEL'
            )
        ),


    constraint chk_mart_planos_acao_criador
        check (
            status_criador in (
                'UNICO',
                'MULTIPLAS_VARIANTES',
                'AUSENTE'
            )
        ),


    constraint chk_mart_planos_acao_duplicado
        check (
            duplicado_origem in (
                'SIM',
                'NAO'
            )
        ),


    constraint chk_mart_planos_acao_registros_origem
        check (
            registros_origem > 0
        ),


    constraint chk_mart_planos_acao_flags
        check (
            flag_ativo_fonte in (0, 1)
            and flag_aberto_fonte in (0, 1)
            and flag_atrasado_fonte in (0, 1)
            and flag_fechado_fonte in (0, 1)
            and flag_fechado_apos_prazo_fonte in (0, 1)
            and flag_vencido_calculado in (0, 1)
            and flag_em_prazo_calculado in (0, 1)
            and flag_vence_hoje in (0, 1)
            and divergencia_status_prazo in (0, 1)
        )
);


-- =========================================================
-- 2. STAGING
-- =========================================================

create table if not exists public.stg_mart_planos_acao (

    carga_id uuid not null,

    plano_id text not null,

    id_resposta bigint,

    nome_plano text,
    modulo_origem text,

    inicio_plano date,
    criacao_plano date,
    cronograma_plano date,
    encerramento_plano date,

    nivel_organizacional text,
    divisao_plano text not null,

    estado_plano_fonte text not null,

    flag_ativo_fonte smallint not null,
    flag_aberto_fonte smallint not null,
    flag_atrasado_fonte smallint not null,
    flag_fechado_fonte smallint not null,
    flag_fechado_apos_prazo_fonte smallint not null,

    data_referencia date not null,

    dias_para_prazo integer,
    dias_em_atraso_calculado integer,

    situacao_prazo_calculada text not null,

    flag_vencido_calculado smallint not null,
    flag_em_prazo_calculado smallint not null,
    flag_vence_hoje smallint not null,

    divergencia_status_prazo smallint not null,

    criador_plano text,
    criador_plano_variantes text,

    status_criador text not null,

    gestor_plano text,

    grupo_sso text not null,
    metodo_classificacao text not null,

    descricao_plano text,
    contrato_plano text,

    registros_origem integer not null,
    duplicado_origem text not null,

    carregado_em timestamptz
        not null
        default now(),


    primary key (
        carga_id,
        plano_id
    )
);


-- =========================================================
-- 3. INDICES
-- =========================================================

create index if not exists
idx_mart_planos_acao_grupo
on public.mart_planos_acao(
    grupo_sso
);


create index if not exists
idx_mart_planos_acao_estado
on public.mart_planos_acao(
    estado_plano_fonte
);


create index if not exists
idx_mart_planos_acao_gestor
on public.mart_planos_acao(
    gestor_plano
);


create index if not exists
idx_mart_planos_acao_cronograma
on public.mart_planos_acao(
    cronograma_plano
);


create index if not exists
idx_mart_planos_acao_situacao_prazo
on public.mart_planos_acao(
    situacao_prazo_calculada
);


-- =========================================================
-- 4. ROW LEVEL SECURITY
-- =========================================================

alter table public.mart_planos_acao
enable row level security;


alter table public.stg_mart_planos_acao
enable row level security;


-- =========================================================
-- 5. PERMISSOES
-- =========================================================

revoke all
on table public.mart_planos_acao
from anon, authenticated;


revoke all
on table public.stg_mart_planos_acao
from anon, authenticated;


-- MART oficial:
-- publicador nao escreve diretamente.

revoke insert, update, delete, truncate
on table public.mart_planos_acao
from service_role;


grant select
on table public.mart_planos_acao
to service_role;


-- STAGING:
-- publicador pode carregar, validar e limpar.

grant select, insert, delete
on table public.stg_mart_planos_acao
to service_role;


revoke update, truncate
on table public.stg_mart_planos_acao
from service_role;


-- =========================================================
-- 6. PROMOCAO ATOMICA
-- =========================================================

create or replace function
public.promover_mart_planos_acao(
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
    from public.stg_mart_planos_acao
    where carga_id = p_carga_id;


    if v_staging = 0 then

        raise exception
            'Nenhum registro encontrado na staging para carga_id %.',
            p_carga_id;

    end if;


    if (
        v_staging
        <> p_quantidade_esperada
    ) then

        raise exception
            'Quantidade da staging (%) difere da esperada (%).',
            v_staging,
            p_quantidade_esperada;

    end if;


    lock table
        public.mart_planos_acao
    in exclusive mode;


    delete
    from public.mart_planos_acao;


    insert into public.mart_planos_acao (

        plano_id,
        id_resposta,

        nome_plano,
        modulo_origem,

        inicio_plano,
        criacao_plano,
        cronograma_plano,
        encerramento_plano,

        nivel_organizacional,
        divisao_plano,

        estado_plano_fonte,

        flag_ativo_fonte,
        flag_aberto_fonte,
        flag_atrasado_fonte,
        flag_fechado_fonte,
        flag_fechado_apos_prazo_fonte,

        data_referencia,

        dias_para_prazo,
        dias_em_atraso_calculado,

        situacao_prazo_calculada,

        flag_vencido_calculado,
        flag_em_prazo_calculado,
        flag_vence_hoje,

        divergencia_status_prazo,

        criador_plano,
        criador_plano_variantes,
        status_criador,

        gestor_plano,

        grupo_sso,
        metodo_classificacao,

        descricao_plano,
        contrato_plano,

        registros_origem,
        duplicado_origem
    )

    select

        plano_id,
        id_resposta,

        nome_plano,
        modulo_origem,

        inicio_plano,
        criacao_plano,
        cronograma_plano,
        encerramento_plano,

        nivel_organizacional,
        divisao_plano,

        estado_plano_fonte,

        flag_ativo_fonte,
        flag_aberto_fonte,
        flag_atrasado_fonte,
        flag_fechado_fonte,
        flag_fechado_apos_prazo_fonte,

        data_referencia,

        dias_para_prazo,
        dias_em_atraso_calculado,

        situacao_prazo_calculada,

        flag_vencido_calculado,
        flag_em_prazo_calculado,
        flag_vence_hoje,

        divergencia_status_prazo,

        criador_plano,
        criador_plano_variantes,
        status_criador,

        gestor_plano,

        grupo_sso,
        metodo_classificacao,

        descricao_plano,
        contrato_plano,

        registros_origem,
        duplicado_origem

    from public.stg_mart_planos_acao

    where carga_id = p_carga_id

    order by plano_id;


    select count(*)
    into v_publicado
    from public.mart_planos_acao;


    if (
        v_publicado
        <> p_quantidade_esperada
    ) then

        raise exception
            'Quantidade publicada (%) difere da esperada (%).',
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
on function public.promover_mart_planos_acao(
    uuid,
    integer
)
from public, anon, authenticated;


grant execute
on function public.promover_mart_planos_acao(
    uuid,
    integer
)
to service_role;


commit;
