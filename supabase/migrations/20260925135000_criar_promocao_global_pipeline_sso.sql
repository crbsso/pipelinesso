begin;

-- =========================================================
-- PROMOCAO GLOBAL ATOMICA - PIPELINE SSO
-- =========================================================
--
-- Objetivo:
-- promover Inspecoes e AVCB na mesma transacao.
--
-- Se qualquer promocao falhar, nenhuma das duas MARTs
-- deve permanecer alterada.
--
-- As regras especificas de cada MART continuam
-- centralizadas nas RPCs ja existentes:
--
--   promover_mart_inspecoes(...)
--   promover_mart_avcb(...)
--
-- =========================================================


create or replace function
public.promover_pipeline_sso(
    p_carga_inspecoes uuid,
    p_quantidade_inspecoes integer,
    p_carga_avcb uuid,
    p_quantidade_avcb integer
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

begin

    -- =====================================================
    -- VALIDACAO DOS PARAMETROS
    -- =====================================================

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


    -- =====================================================
    -- GATE GLOBAL
    -- =====================================================
    --
    -- As duas MARTs sao bloqueadas antes da primeira
    -- promocao.
    --
    -- As leituras normais continuam protegidas pelo MVCC
    -- do PostgreSQL e somente enxergam um estado
    -- transacional consistente.
    --
    -- =====================================================

    lock table
        public.mart_inspecoes,
        public.mart_avcb
    in exclusive mode;


    -- =====================================================
    -- PROMOCAO INSPECOES
    -- =====================================================

    v_inspecoes :=
        public.promover_mart_inspecoes(
            p_carga_inspecoes,
            p_quantidade_inspecoes
        );


    if v_inspecoes <> p_quantidade_inspecoes then

        raise exception
            'Promocao de Inspecoes retornou quantidade '
            'divergente. Esperado: %. Retornado: %.',
            p_quantidade_inspecoes,
            v_inspecoes;

    end if;


    -- =====================================================
    -- PROMOCAO AVCB
    -- =====================================================

    v_avcb :=
        public.promover_mart_avcb(
            p_carga_avcb,
            p_quantidade_avcb
        );


    if v_avcb <> p_quantidade_avcb then

        raise exception
            'Promocao de AVCB retornou quantidade '
            'divergente. Esperado: %. Retornado: %.',
            p_quantidade_avcb,
            v_avcb;

    end if;


    -- =====================================================
    -- RESULTADO
    -- =====================================================

    return jsonb_build_object(
        'inspecoes', v_inspecoes,
        'avcb', v_avcb
    );

end;

$$;


-- =========================================================
-- SEGURANCA
-- =========================================================

revoke all
on function public.promover_pipeline_sso(
    uuid,
    integer,
    uuid,
    integer
)
from public, anon, authenticated;


grant execute
on function public.promover_pipeline_sso(
    uuid,
    integer,
    uuid,
    integer
)
to service_role;


commit;
