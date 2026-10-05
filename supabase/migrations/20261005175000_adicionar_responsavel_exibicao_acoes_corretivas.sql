begin;


-- ============================================================
-- PORTAL SSO
-- IDENTIDADE DE RESPONSAVEL - ACOES CORRETIVAS
--
-- responsavel_acao:
--   permanece interno.
--
-- responsavel_exibicao:
--   nome seguro destinado ao Portal.
--
-- metodo_identidade_responsavel:
--   rastreabilidade interna da resolucao de identidade.
-- ============================================================


-- ============================================================
-- 1. MART
-- ============================================================

alter table
public.mart_acoes_corretivas

add column if not exists
responsavel_exibicao text;


alter table
public.mart_acoes_corretivas

add column if not exists
metodo_identidade_responsavel text;


alter table
public.mart_acoes_corretivas

drop constraint if exists
chk_mart_acoes_corretivas_identidade_responsavel;


alter table
public.mart_acoes_corretivas

add constraint
chk_mart_acoes_corretivas_identidade_responsavel

check (
    metodo_identidade_responsavel is null
    or metodo_identidade_responsavel in (
        'MAPA_RM_EXATO',
        'MAPA_RM_ALIAS_COMPARTILHADO',
        'MAPA_RM_ALIAS_ACAO',
        'PREVSYS_SEM_RM'
    )
);


alter table
public.mart_acoes_corretivas

drop constraint if exists
chk_mart_acoes_corretivas_responsavel_exibicao;


alter table
public.mart_acoes_corretivas

add constraint
chk_mart_acoes_corretivas_responsavel_exibicao

check (
    responsavel_exibicao is null
    or btrim(
        responsavel_exibicao
    ) <> ''
);


-- ============================================================
-- 2. STAGING
-- ============================================================

alter table
public.stg_mart_acoes_corretivas

add column if not exists
responsavel_exibicao text;


alter table
public.stg_mart_acoes_corretivas

add column if not exists
metodo_identidade_responsavel text;


alter table
public.stg_mart_acoes_corretivas

drop constraint if exists
chk_stg_acoes_corretivas_identidade_responsavel;


alter table
public.stg_mart_acoes_corretivas

add constraint
chk_stg_acoes_corretivas_identidade_responsavel

check (
    metodo_identidade_responsavel is null
    or metodo_identidade_responsavel in (
        'MAPA_RM_EXATO',
        'MAPA_RM_ALIAS_COMPARTILHADO',
        'MAPA_RM_ALIAS_ACAO',
        'PREVSYS_SEM_RM'
    )
);


alter table
public.stg_mart_acoes_corretivas

drop constraint if exists
chk_stg_acoes_corretivas_responsavel_exibicao;


alter table
public.stg_mart_acoes_corretivas

add constraint
chk_stg_acoes_corretivas_responsavel_exibicao

check (
    responsavel_exibicao is null
    or btrim(
        responsavel_exibicao
    ) <> ''
);


-- ============================================================
-- 3. INDICE PARA FILTRO DO PORTAL
-- ============================================================

create index if not exists
idx_mart_acoes_corretivas_responsavel_exibicao

on public.mart_acoes_corretivas(
    responsavel_exibicao
);


-- ============================================================
-- 4. RPC DE PROMOCAO
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
        responsavel_exibicao,
        metodo_identidade_responsavel,

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
        responsavel_exibicao,
        metodo_identidade_responsavel,

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
-- 5. VIEW SEGURA DO PORTAL
--
-- responsavel_acao NAO e exposto.
-- metodo_identidade_responsavel NAO e exposto.
-- Somente responsavel_exibicao chega ao frontend.
--
-- A nova coluna e adicionada ao FINAL para preservar
-- o contrato existente da view.
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

    grupo_sso,

    responsavel_exibicao

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
