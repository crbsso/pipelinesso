begin;

-- ============================================================
-- NOME DE EXIBICAO DO RESPONSAVEL
-- Nome completo permanece apenas nas camadas internas.
-- ============================================================

alter table public.stg_mart_planos_acao
    add column if not exists gestor_exibicao text;

alter table public.mart_planos_acao
    add column if not exists gestor_exibicao text;


-- ============================================================
-- PROMOCAO STAGING -> MART
-- ============================================================

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
    from public.mart_planos_acao
    where plano_id is not null;


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

        gestor_exibicao,
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

        gestor_exibicao,
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


-- ============================================================
-- VIEW SEGURA DO PORTAL
-- Somente nome_exibicao pode chegar ao navegador.
-- ============================================================

create or replace view public.vw_portal_planos_acao as
select
    modulo_origem,
    cronograma_plano,
    nivel_organizacional,
    flag_ativo_fonte,
    dias_para_prazo,
    dias_em_atraso_calculado,
    situacao_prazo_calculada,
    situacao_gerencial,
    flag_vence_hoje,
    grupo_sso,
    gestor_exibicao
from public.mart_planos_acao;

revoke all
on public.vw_portal_planos_acao
from public;

revoke all
on public.vw_portal_planos_acao
from anon;

revoke all
on public.vw_portal_planos_acao
from authenticated;

grant select
on public.vw_portal_planos_acao
to service_role;

commit;
