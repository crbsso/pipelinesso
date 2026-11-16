-- PORTAL SSO / CELEO - ETAPA 26
-- ROLLBACK DA INTEGRACAO DE LEITURA EM HML.
-- NAO executar automaticamente.
-- NAO executar em producao.
-- Nao apaga registros complementares nem historicos.

BEGIN;

DO $etapa26$
DECLARE
    definicao_atual text;
    definicao_anterior text;
BEGIN
    definicao_atual := pg_catalog.pg_get_viewdef(
        'public.vw_motoristas_direcao_4h'::regclass,
        true
    );

    IF pg_catalog.md5(definicao_atual)
       <> 'ec2423beb19f908dd03ab0cf874ed1ff' THEN
        RAISE EXCEPTION 'ROLLBACK_VIEW_DIRECAO_DIVERGENTE';
    END IF;
    IF definicao_atual !~
       'FROM (public\.)?vw_motoristas_historico_fim_efetivo (AS )?fato_motoristas_viagens' THEN
        RAISE EXCEPTION 'DIRECAO_NAO_UTILIZA_VIEW_COMPLEMENTAR';
    END IF;

    definicao_anterior := pg_catalog.regexp_replace(
        definicao_atual,
        'FROM (public\.)?vw_motoristas_historico_fim_efetivo (AS )?fato_motoristas_viagens',
        'FROM fato_motoristas_viagens'
    );

    IF definicao_anterior = definicao_atual
       OR definicao_anterior LIKE '%vw_motoristas_historico_fim_efetivo%' THEN
        RAISE EXCEPTION 'ROLLBACK_INSEGURO';
    END IF;

    EXECUTE
        'CREATE OR REPLACE VIEW public.vw_motoristas_direcao_4h '
        || 'WITH (security_invoker = true) AS '
        || definicao_anterior;
END;
$etapa26$;

DROP VIEW public.vw_motoristas_historico_fim_efetivo;

COMMIT;