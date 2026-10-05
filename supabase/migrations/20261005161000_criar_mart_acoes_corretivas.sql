begin;


-- ============================================================
-- PORTAL SSO
-- MART ACOES CORRETIVAS
--
-- Fluxo:
--   1. Python carrega STAGING com carga_id
--   2. Python valida STAGING remotamente
--   3. RPC promove a carga de forma atomica
--   4. Python valida MART oficial
--   5. Python limpa a STAGING
--
-- Dados pessoais e textos detalhados permanecem no MART.
-- A VIEW do Portal expoe somente o contrato necessario.
-- ============================================================


-- ============================================================
-- 1. MART OFICIAL
-- ============================================================

create table if not exists public.mart_acoes_corretivas (

    acao_corretiva_id text primary key,

    plano_id text not null,
    id_resposta bigint,

    nome_formulario text,
    modulo_origem text,

    data_inicio date not null,
    prazo date not null,
    proxima_verificacao date,

    nivel_organizacional text,

    grupo_sso text not null,
    metodo_classificacao text not null,

    gestor_plano text,
    responsavel_acao text,

    estado_plano text,
    estado_acao_fonte text not null,

    flag_ativo_fonte smallint not null,
    flag_aberto_fonte smallint not null,
    flag_atrasado_fonte smallint not null,
    flag_fechado_fonte smallint not null,
    flag_fechado_apos_prazo_fonte smallint not null,

    data_referencia date not null,

    dias_para_prazo integer,
    dias_em_atraso_calculado integer,

    situacao_prazo_calculada text not null,
    situacao_gerencial text not null,

    flag_vencido_calculado smallint not null,
    flag_em_prazo_calculado smallint not null,
    flag_vence_hoje smallint not null,

    divergencia_status_prazo smallint not null,

    estado_aprovacao text,
    oficial_aprovacao text,

    nome_plano text,
    pergunta text,
    descricao_acao text,
    descricao_final text,

    registros_origem integer not null,
    duplicado_origem smallint not null,


    constraint chk_mart_acoes_corretivas_grupo
        check (
            grupo_sso in (
                'SEGURANCA',
                'OUTRAS_AREAS'
            )
        ),


    constraint chk_mart_acoes_corretivas_metodo
        check (
            metodo_classificacao in (
                'NIVEL_ORGANIZACIONAL',
                'MAPA_GESTOR',
                'PADRAO',
                'MAPA_RM_EXATO',
                'MAPA_RM_ALIAS'
            )
        ),


    constraint chk_mart_acoes_corretivas_prazo
        check (
            situacao_prazo_calculada in (
                'EM_PRAZO',
                'VENCE_HOJE',
                'VENCIDO',
                'SEM_PRAZO',
                'NAO_APLICAVEL'
            )
        ),


    constraint chk_mart_acoes_corretivas_gerencial
        check (
            situacao_gerencial in (
                'EM_PRAZO',
                'VENCE_HOJE',
                'VENCIDO',
                'SEM_PRAZO',
                'FECHADO',
                'FECHADO_APOS_PRAZO'
            )
        ),


    constraint chk_mart_acoes_corretivas_registros
        check (
            registros_origem > 0
        ),


    constraint chk_mart_acoes_corretivas_duplicado
        check (
            duplicado_origem in (
                0,
                1
            )
        ),


    constraint chk_mart_acoes_corretivas_flags
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
        ),


    constraint chk_mart_acoes_corretivas_estado_unico
        check (
            (
                flag_aberto_fonte
                + flag_atrasado_fonte
                + flag_fechado_fonte
                + flag_fechado_apos_prazo_fonte
            ) = 1
        ),


    constraint chk_mart_acoes_corretivas_ativo
        check (
            flag_ativo_fonte
            = (
                flag_aberto_fonte
                + flag_atrasado_fonte
            )
        ),


    constraint chk_mart_acoes_corretivas_dias_prazo
        check (
            dias_para_prazo is null
            or dias_para_prazo >= 0
        ),


    constraint chk_mart_acoes_corretivas_dias_atraso
        check (
            dias_em_atraso_calculado is null
            or dias_em_atraso_calculado > 0
        )
);


-- ============================================================
-- 2. STAGING
-- ============================================================

create table if not exists public.stg_mart_acoes_corretivas (

    carga_id uuid not null,

    acao_corretiva_id text not null,

    plano_id text not null,
    id_resposta bigint,

    nome_formulario text,
    modulo_origem text,

    data_inicio date not null,
    prazo date not null,
    proxima_verificacao date,

    nivel_organizacional text,

    grupo_sso text not null,
    metodo_classificacao text not null,

    gestor_plano text,
    responsavel_acao text,

    estado_plano text,
    estado_acao_fonte text not null,

    flag_ativo_fonte smallint not null,
    flag_aberto_fonte smallint not null,
    flag_atrasado_fonte smallint not null,
    flag_fechado_fonte smallint not null,
    flag_fechado_apos_prazo_fonte smallint not null,

    data_referencia date not null,

    dias_para_prazo integer,
    dias_em_atraso_calculado integer,

    situacao_prazo_calculada text not null,
    situacao_gerencial text not null,

    flag_vencido_calculado smallint not null,
    flag_em_prazo_calculado smallint not null,
    flag_vence_hoje smallint not null,

    divergencia_status_prazo smallint not null,

    estado_aprovacao text,
    oficial_aprovacao text,

    nome_plano text,
    pergunta text,
    descricao_acao text,
    descricao_final text,

    registros_origem integer not null,
    duplicado_origem smallint not null,

    carregado_em timestamptz
        not null
        default now(),


    primary key (
        carga_id,
        acao_corretiva_id
    ),


    constraint chk_stg_acoes_corretivas_grupo
        check (
            grupo_sso in (
                'SEGURANCA',
                'OUTRAS_AREAS'
            )
        ),


    constraint chk_stg_acoes_corretivas_metodo
        check (
            metodo_classificacao in (
                'NIVEL_ORGANIZACIONAL',
                'MAPA_GESTOR',
                'PADRAO',
                'MAPA_RM_EXATO',
                'MAPA_RM_ALIAS'
            )
        ),


    constraint chk_stg_acoes_corretivas_prazo
        check (
            situacao_prazo_calculada in (
                'EM_PRAZO',
                'VENCE_HOJE',
                'VENCIDO',
                'SEM_PRAZO',
                'NAO_APLICAVEL'
            )
        ),


    constraint chk_stg_acoes_corretivas_gerencial
        check (
            situacao_gerencial in (
                'EM_PRAZO',
                'VENCE_HOJE',
                'VENCIDO',
                'SEM_PRAZO',
                'FECHADO',
                'FECHADO_APOS_PRAZO'
            )
        ),


    constraint chk_stg_acoes_corretivas_registros
        check (
            registros_origem > 0
        ),


    constraint chk_stg_acoes_corretivas_duplicado
        check (
            duplicado_origem in (
                0,
                1
            )
        ),


    constraint chk_stg_acoes_corretivas_flags
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
        ),


    constraint chk_stg_acoes_corretivas_estado_unico
        check (
            (
                flag_aberto_fonte
                + flag_atrasado_fonte
                + flag_fechado_fonte
                + flag_fechado_apos_prazo_fonte
            ) = 1
        ),


    constraint chk_stg_acoes_corretivas_ativo
        check (
            flag_ativo_fonte
            = (
                flag_aberto_fonte
                + flag_atrasado_fonte
            )
        ),


    constraint chk_stg_acoes_corretivas_dias_prazo
        check (
            dias_para_prazo is null
            or dias_para_prazo >= 0
        ),


    constraint chk_stg_acoes_corretivas_dias_atraso
        check (
            dias_em_atraso_calculado is null
            or dias_em_atraso_calculado > 0
        )
);


-- ============================================================
-- 3. INDICES
-- ============================================================

create index if not exists
idx_mart_acoes_corretivas_plano
on public.mart_acoes_corretivas(
    plano_id
);


create index if not exists
idx_mart_acoes_corretivas_grupo
on public.mart_acoes_corretivas(
    grupo_sso
);


create index if not exists
idx_mart_acoes_corretivas_estado
on public.mart_acoes_corretivas(
    estado_acao_fonte
);


create index if not exists
idx_mart_acoes_corretivas_responsavel
on public.mart_acoes_corretivas(
    responsavel_acao
);


create index if not exists
idx_mart_acoes_corretivas_prazo
on public.mart_acoes_corretivas(
    prazo
);


create index if not exists
idx_mart_acoes_corretivas_situacao
on public.mart_acoes_corretivas(
    situacao_gerencial
);


-- ============================================================
-- 4. ROW LEVEL SECURITY
-- ============================================================

alter table public.mart_acoes_corretivas
enable row level security;


alter table public.stg_mart_acoes_corretivas
enable row level security;


-- ============================================================
-- 5. PERMISSOES
-- ============================================================

revoke all
on table public.mart_acoes_corretivas
from anon, authenticated;


revoke all
on table public.stg_mart_acoes_corretivas
from anon, authenticated;


-- MART:
-- publicador nao escreve diretamente.

revoke insert, update, delete, truncate
on table public.mart_acoes_corretivas
from service_role;


grant select
on table public.mart_acoes_corretivas
to service_role;


-- STAGING:
-- publicador pode carregar, validar e limpar.

grant select, insert, delete
on table public.stg_mart_acoes_corretivas
to service_role;


revoke update, truncate
on table public.stg_mart_acoes_corretivas
from service_role;


-- ============================================================
-- 6. PROMOCAO ATOMICA
-- ============================================================

create or replace function
public.promover_mart_acoes_corretivas(
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
    from public.stg_mart_acoes_corretivas
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
        public.mart_acoes_corretivas
    in exclusive mode;


    delete
    from public.mart_acoes_corretivas
    where acao_corretiva_id is not null;


    insert into public.mart_acoes_corretivas (

        acao_corretiva_id,
        plano_id,
        id_resposta,

        nome_formulario,
        modulo_origem,

        data_inicio,
        prazo,
        proxima_verificacao,

        nivel_organizacional,

        grupo_sso,
        metodo_classificacao,

        gestor_plano,
        responsavel_acao,

        estado_plano,
        estado_acao_fonte,

        flag_ativo_fonte,
        flag_aberto_fonte,
        flag_atrasado_fonte,
        flag_fechado_fonte,
        flag_fechado_apos_prazo_fonte,

        data_referencia,

        dias_para_prazo,
        dias_em_atraso_calculado,

        situacao_prazo_calculada,
        situacao_gerencial,

        flag_vencido_calculado,
        flag_em_prazo_calculado,
        flag_vence_hoje,

        divergencia_status_prazo,

        estado_aprovacao,
        oficial_aprovacao,

        nome_plano,
        pergunta,
        descricao_acao,
        descricao_final,

        registros_origem,
        duplicado_origem
    )

    select

        acao_corretiva_id,
        plano_id,
        id_resposta,

        nome_formulario,
        modulo_origem,

        data_inicio,
        prazo,
        proxima_verificacao,

        nivel_organizacional,

        grupo_sso,
        metodo_classificacao,

        gestor_plano,
        responsavel_acao,

        estado_plano,
        estado_acao_fonte,

        flag_ativo_fonte,
        flag_aberto_fonte,
        flag_atrasado_fonte,
        flag_fechado_fonte,
        flag_fechado_apos_prazo_fonte,

        data_referencia,

        dias_para_prazo,
        dias_em_atraso_calculado,

        situacao_prazo_calculada,
        situacao_gerencial,

        flag_vencido_calculado,
        flag_em_prazo_calculado,
        flag_vence_hoje,

        divergencia_status_prazo,

        estado_aprovacao,
        oficial_aprovacao,

        nome_plano,
        pergunta,
        descricao_acao,
        descricao_final,

        registros_origem,
        duplicado_origem

    from public.stg_mart_acoes_corretivas

    where carga_id = p_carga_id

    order by acao_corretiva_id;


    select count(*)
    into v_publicado
    from public.mart_acoes_corretivas;


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


-- ============================================================
-- 7. SEGURANCA DA RPC
-- ============================================================

revoke all
on function public.promover_mart_acoes_corretivas(
    uuid,
    integer
)
from public, anon, authenticated;


grant execute
on function public.promover_mart_acoes_corretivas(
    uuid,
    integer
)
to service_role;


-- ============================================================
-- 8. VIEW SEGURA DO PORTAL
--
-- Nomes completos, pergunta e descricoes nao sao expostos.
-- Podemos ampliar este contrato depois, se necessario.
-- ============================================================

create or replace view
public.vw_portal_acoes_corretivas
as
select

    acao_corretiva_id,
    plano_id,
    id_resposta,

    nome_formulario,
    modulo_origem,

    data_inicio,
    prazo,
    proxima_verificacao,

    nivel_organizacional,

    estado_acao_fonte,
    estado_aprovacao,

    flag_ativo_fonte,

    dias_para_prazo,
    dias_em_atraso_calculado,

    situacao_prazo_calculada,
    situacao_gerencial,

    flag_vence_hoje,

    grupo_sso

from public.mart_acoes_corretivas;


revoke all
on public.vw_portal_acoes_corretivas
from public;


revoke all
on public.vw_portal_acoes_corretivas
from anon;


revoke all
on public.vw_portal_acoes_corretivas
from authenticated;


grant select
on public.vw_portal_acoes_corretivas
to service_role;


commit;
