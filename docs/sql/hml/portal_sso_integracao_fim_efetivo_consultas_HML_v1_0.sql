-- PORTAL SSO / CELEO - ETAPA 26
-- Contrato preparado para HML: ckfsarzmudwdehiiltwi
-- NAO executar automaticamente.
-- NAO executar em producao.
-- Preserva o historico e os controles de Velocidade.

BEGIN;

CREATE VIEW public.vw_motoristas_historico_fim_efetivo
WITH (security_invoker = true) AS
SELECT
    f.evento_id,
    f.tipo_evento,
    f.data_evento,
    f.ano_evento,
    f.mes_evento,
    f.inicio,
    COALESCE(f.fim, c.fim_observado) AS fim,
    f.nome_exibicao,
    f.driver_id_cobli,
    f.situacao_motorista,
    f.coligada,
    f.secao_rm,
    f.placa,
    f.distancia_km,
    f.duracao_viagem_min,
    f.marcha_lenta_min,
    f.vehicle_id_cobli
FROM public.fato_motoristas_viagens AS f
LEFT JOIN sso_private.motoristas_viagens_fim_complementar AS c
    ON c.evento_id_historico = f.evento_id;

REVOKE ALL ON public.vw_motoristas_historico_fim_efetivo
    FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.vw_motoristas_historico_fim_efetivo
    TO service_role;

-- Modifica apenas a origem das viagens na view de Direcao.
-- Preserva a CTE de paradas e as regras de calculo.

DO $etapa26$
DECLARE
    definicao_atual text;
    definicao_nova text;

    ancora_antiga text :=
        E'\n           FROM fato_motoristas_viagens\n          WHERE fato_motoristas_viagens.tipo_evento = ''VIAGEM''::text';

    ancora_nova text :=
        E'\n           FROM public.vw_motoristas_historico_fim_efetivo AS fato_motoristas_viagens\n          WHERE fato_motoristas_viagens.tipo_evento = ''VIAGEM''::text';

BEGIN
    definicao_atual := pg_catalog.pg_get_viewdef(
        'public.vw_motoristas_direcao_4h'::regclass,
        true
    );

    -- Fingerprint da definicao verificada na HML.
    IF pg_catalog.md5(definicao_atual)
       <> '7821b5d45f17eeaaa760876da256c2b7' THEN
        RAISE EXCEPTION 'VIEW_DIRECAO_DIVERGENTE_NAO_ALTERAR';
    END IF;

    IF pg_catalog.strpos(definicao_atual, ancora_antiga) = 0
       OR pg_catalog.strpos(definicao_atual, '), paradas AS (') = 0 THEN
        RAISE EXCEPTION 'ANCORA_DIRECAO_NAO_ENCONTRADA';
    END IF;

    definicao_nova := pg_catalog.replace(
        definicao_atual,
        ancora_antiga,
        ancora_nova
    );

    IF definicao_nova = definicao_atual
       OR pg_catalog.strpos(definicao_nova, ancora_antiga) > 0 THEN
        RAISE EXCEPTION 'SUBSTITUICAO_DIRECAO_AMBIGUA';
    END IF;

    EXECUTE
        'CREATE OR REPLACE VIEW public.vw_motoristas_direcao_4h '
        || 'WITH (security_invoker = true) AS '
        || definicao_nova;
END;
$etapa26$;

COMMIT;