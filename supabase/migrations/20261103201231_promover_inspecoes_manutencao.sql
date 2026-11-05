-- Portal SSO / CELEO
-- RPC exclusiva das Inspecoes da Manutencao.
-- Promocao mensal atomica.
-- Nao altera mart_inspecoes nem o pipeline global.

CREATE FUNCTION public.promover_inspecoes_manutencao(
    p_carga_id uuid,
    p_quantidade_esperada integer,
    p_inicio date,
    p_fim date
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $rpc$
DECLARE
    v_staging bigint;
    v_inseridos bigint;
    v_publicados bigint;
BEGIN
    IF p_carga_id IS NULL THEN
        RAISE EXCEPTION 'carga_id nao pode ser nulo';
    END IF;

    IF p_quantidade_esperada IS NULL
       OR p_quantidade_esperada <= 0 THEN
        RAISE EXCEPTION 'Quantidade esperada invalida';
    END IF;

    IF p_inicio IS NULL
       OR p_fim IS NULL
       OR EXTRACT(DAY FROM p_inicio) <> 1
       OR p_fim <> (p_inicio + INTERVAL '1 month')::date THEN
        RAISE EXCEPTION 'Periodo deve corresponder a um mes completo';
    END IF;

    -- Serializa promocoes e evita substituicoes simultaneas.
    LOCK TABLE public.mart_inspecoes_manutencao
        IN EXCLUSIVE MODE;

    SELECT COUNT(*)
    INTO v_staging
    FROM public.stg_inspecoes_manutencao
    WHERE carga_id = p_carga_id;

    IF v_staging <> p_quantidade_esperada THEN
        RAISE EXCEPTION
            'Staging: % registros; esperado: %',
            v_staging, p_quantidade_esperada;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.stg_inspecoes_manutencao
        WHERE carga_id = p_carga_id
          AND (
              data_inspecao < p_inicio
              OR data_inspecao >= p_fim
          )
    ) THEN
        RAISE EXCEPTION
            'Carga contem registros fora do periodo informado';
    END IF;

    -- A substituicao e restrita ao mes validado.
    DELETE FROM public.mart_inspecoes_manutencao
    WHERE data_inspecao >= p_inicio
      AND data_inspecao < p_fim;

    INSERT INTO public.mart_inspecoes_manutencao (
        id_inspecao,
        ficha_id,
        aba_id,
        ativo_id,
        data_inspecao,
        concessao,
        localizacao,
        familia,
        tipo,
        periodicidade,
        origem,
        carga_id
    )
    SELECT
        id_inspecao,
        ficha_id,
        aba_id,
        ativo_id,
        data_inspecao,
        concessao,
        localizacao,
        familia,
        tipo,
        periodicidade,
        origem,
        carga_id
    FROM public.stg_inspecoes_manutencao
    WHERE carga_id = p_carga_id;

    GET DIAGNOSTICS v_inseridos = ROW_COUNT;

    IF v_inseridos <> p_quantidade_esperada THEN
        RAISE EXCEPTION
            'Inseridos: %; esperado: %',
            v_inseridos, p_quantidade_esperada;
    END IF;

    SELECT COUNT(*)
    INTO v_publicados
    FROM public.mart_inspecoes_manutencao
    WHERE data_inspecao >= p_inicio
      AND data_inspecao < p_fim;

    IF v_publicados <> p_quantidade_esperada THEN
        RAISE EXCEPTION
            'Reconciliacao final divergente';
    END IF;

    RETURN v_publicados::integer;
END;
$rpc$;

REVOKE ALL
ON FUNCTION public.promover_inspecoes_manutencao(
    uuid, integer, date, date
)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
ON FUNCTION public.promover_inspecoes_manutencao(
    uuid, integer, date, date
)
TO service_role;