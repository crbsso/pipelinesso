begin;


-- =========================================================
-- PROMOCAO GLOBAL ATOMICA - PIPELINE SSO
-- INSPECOES + AVCB + PLANOS DE ACAO + MOTORISTAS
-- =========================================================


create or replace function
public.promover_pipeline_sso(
    p_carga_inspecoes uuid,
    p_quantidade_inspecoes integer,
    p_carga_avcb uuid,
    p_quantidade_avcb integer,
    p_carga_planos_acao uuid,
    p_quantidade_planos_acao integer,
    p_carga_motoristas uuid,
    p_quantidades_motoristas jsonb
)
returns jsonb

language plpgsql

security definer

set search_path =
    pg_catalog,
    public

as $$

declare

    v_inspecoes integer;
    v_avcb integer;
    v_planos_acao integer;
    v_motoristas jsonb;

begin


    if p_carga_inspecoes is null then
        raise exception
            'carga_id de Inspecoes nao pode ser nulo.';
    end if;


    if (
        p_quantidade_inspecoes is null
        or p_quantidade_inspecoes <= 0
    ) then
        raise exception
            'Quantidade esperada de Inspecoes invalida: %',
            p_quantidade_inspecoes;
    end if;


    if p_carga_avcb is null then
        raise exception
            'carga_id de AVCB nao pode ser nulo.';
    end if;


    if (
        p_quantidade_avcb is null
        or p_quantidade_avcb <= 0
    ) then
        raise exception
            'Quantidade esperada de AVCB invalida: %',
            p_quantidade_avcb;
    end if;


    if p_carga_planos_acao is null then
        raise exception
            'carga_id de Planos de Acao nao pode ser nulo.';
    end if;


    if (
        p_quantidade_planos_acao is null
        or p_quantidade_planos_acao <= 0
    ) then
        raise exception
            'Quantidade esperada de Planos de Acao invalida: %',
            p_quantidade_planos_acao;
    end if;


    if p_carga_motoristas is null then
        raise exception
            'carga_id de Motoristas nao pode ser nulo.';
    end if;


    if (
        p_quantidades_motoristas is null
        or jsonb_typeof(
            p_quantidades_motoristas
        ) <> 'object'
    ) then
        raise exception
            'Quantidades de Motoristas devem ser objeto JSON.';
    end if;


    lock table
        public.mart_inspecoes,
        public.mart_avcb,
        public.mart_planos_acao,
        public.mart_motoristas,
        public.mart_motoristas_resumo,
        public.mart_motoristas_coligadas,
        public.mart_motoristas_viagens,
        public.mart_motoristas_uso_setor,
        public.mart_motoristas_pendencias_condutor,
        public.mart_motoristas_seguranca,
        public.mart_motoristas_ranking_uso,
        public.mart_motoristas_ranking_seguranca
    in exclusive mode;


    v_inspecoes :=
        public.promover_mart_inspecoes(
            p_carga_inspecoes,
            p_quantidade_inspecoes
        );


    if v_inspecoes <> p_quantidade_inspecoes then

        raise exception
            'Promocao de Inspecoes retornou quantidade divergente. '
            'Esperado: %. Retornado: %.',
            p_quantidade_inspecoes,
            v_inspecoes;

    end if;


    v_avcb :=
        public.promover_mart_avcb(
            p_carga_avcb,
            p_quantidade_avcb
        );


    if v_avcb <> p_quantidade_avcb then

        raise exception
            'Promocao de AVCB retornou quantidade divergente. '
            'Esperado: %. Retornado: %.',
            p_quantidade_avcb,
            v_avcb;

    end if;


    v_planos_acao :=
        public.promover_mart_planos_acao(
            p_carga_planos_acao,
            p_quantidade_planos_acao
        );


    if (
        v_planos_acao
        <> p_quantidade_planos_acao
    ) then

        raise exception
            'Promocao de Planos de Acao retornou quantidade divergente. '
            'Esperado: %. Retornado: %.',
            p_quantidade_planos_acao,
            v_planos_acao;

    end if;


    v_motoristas :=
        public.promover_mart_motoristas(
            p_carga_motoristas,
            p_quantidades_motoristas
        );


    if (
        v_motoristas is null
        or v_motoristas
            <> p_quantidades_motoristas
    ) then

        raise exception
            'Promocao de Motoristas retornou '
            'quantidades divergentes. '
            'Esperado: %. Retornado: %.',
            p_quantidades_motoristas,
            v_motoristas;

    end if;


    return jsonb_build_object(
        'inspecoes', v_inspecoes,
        'avcb', v_avcb,
        'planos_acao', v_planos_acao,
        'motoristas', v_motoristas
    );


end;

$$;


revoke all
on function public.promover_pipeline_sso(
    uuid,
    integer,
    uuid,
    integer,
    uuid,
    integer,
    uuid,
    jsonb
)
from public, anon, authenticated;


grant execute
on function public.promover_pipeline_sso(
    uuid,
    integer,
    uuid,
    integer,
    uuid,
    integer,
    uuid,
    jsonb
)
to service_role;


drop function if exists
public.promover_pipeline_sso(
    uuid,
    integer,
    uuid,
    integer,
    uuid,
    integer
);


commit;
