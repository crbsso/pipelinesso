-- ROLLBACK PREPARADO. SOMENTE PARA SUPABASE HML ckfsarzmudwdehiiltwi.
-- NAO EXECUTAR AUTOMATICAMENTE NEM EM PROD.
-- Restaura somente a RPC v1.0 de complementacao; preserva tabela, fato e staging.
-- Falha se houver complementacoes persistidas ou contrato diferente do v1.1.
BEGIN;
DO $pre$
BEGIN
  IF to_regclass('sso_private.motoristas_viagens_fim_complementar') IS NULL
     OR (SELECT count(*) FROM sso_private.motoristas_viagens_fim_complementar) <> 0
     OR NOT EXISTS(
       SELECT 1 FROM pg_proc
       WHERE oid='public.registrar_fim_complementar_motoristas_sso(text,text,timestamp without time zone,timestamp with time zone)'::regprocedure
         AND position('IDENTIDADE_HASH_DIVERGENTE' IN pg_get_functiondef(oid))>0
     ) THEN
    RAISE EXCEPTION 'ROLLBACK_HML_PRECONDICOES_DIVERGENTES';
  END IF;
END
$pre$;

CREATE OR REPLACE FUNCTION public.registrar_fim_complementar_motoristas_sso(
  p_evento_id_historico text,
  p_evento_id_observado text,
  p_fim_observado timestamp without time zone,
  p_extraido_em_utc timestamp with time zone
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $body$
DECLARE
  v_original record;
  v_complemento record;
  v_inseridos integer;
BEGIN
  IF current_user <> 'service_role' THEN
    RAISE EXCEPTION 'SOMENTE_SERVICE_ROLE';
  END IF;
  IF p_evento_id_historico IS NULL OR p_evento_id_historico !~ '^[0-9a-f]{64}$'
     OR p_evento_id_observado IS NULL OR p_evento_id_observado !~ '^[0-9a-f]{64}$'
     OR p_evento_id_historico = p_evento_id_observado
     OR p_fim_observado IS NULL OR p_extraido_em_utc IS NULL THEN
    RAISE EXCEPTION 'PARAMETROS_COMPLEMENTACAO_INVALIDOS';
  END IF;

  SELECT f.evento_id, f.vehicle_id_cobli, f.tipo_evento, f.inicio, f.fim, f.extraido_em_utc
    INTO v_original
    FROM public.fato_motoristas_viagens AS f
   WHERE f.evento_id = p_evento_id_historico;
  IF NOT FOUND OR v_original.tipo_evento IS DISTINCT FROM 'VIAGEM'
     OR v_original.inicio IS NULL OR v_original.fim IS NOT NULL THEN
    RAISE EXCEPTION 'HISTORICO_NAO_ELEGIVEL_COMPLEMENTACAO';
  END IF;
  IF p_fim_observado <= v_original.inicio THEN
    RAISE EXCEPTION 'FIM_COMPLEMENTAR_NAO_POSTERIOR_AO_INICIO';
  END IF;
  IF v_original.extraido_em_utc IS NULL
     OR p_extraido_em_utc <= v_original.extraido_em_utc THEN
    RAISE EXCEPTION 'EXTRACAO_NAO_POSTERIOR_A_ORIGEM';
  END IF;
  IF EXISTS(SELECT 1 FROM public.fato_motoristas_viagens AS f
             WHERE f.evento_id=p_evento_id_observado) THEN
    RAISE EXCEPTION 'EVENTO_OBSERVADO_JA_PUBLICADO';
  END IF;

  INSERT INTO sso_private.motoristas_viagens_fim_complementar
    (evento_id_historico, evento_id_observado, vehicle_id_cobli,
     inicio, fim_observado, extraido_em_utc)
  VALUES
    (p_evento_id_historico, p_evento_id_observado, v_original.vehicle_id_cobli,
     v_original.inicio, p_fim_observado, p_extraido_em_utc)
  ON CONFLICT (evento_id_historico) DO NOTHING;

  GET DIAGNOSTICS v_inseridos = ROW_COUNT;
  SELECT c.* INTO v_complemento
    FROM sso_private.motoristas_viagens_fim_complementar AS c
   WHERE c.evento_id_historico = p_evento_id_historico;

  IF NOT FOUND
     OR v_complemento.evento_id_observado IS DISTINCT FROM p_evento_id_observado
     OR v_complemento.fim_observado IS DISTINCT FROM p_fim_observado
     OR v_complemento.extraido_em_utc IS DISTINCT FROM p_extraido_em_utc
     OR v_complemento.vehicle_id_cobli IS DISTINCT FROM v_original.vehicle_id_cobli
     OR v_complemento.inicio IS DISTINCT FROM v_original.inicio THEN
    RAISE EXCEPTION 'COMPLEMENTACAO_EXISTENTE_DIVERGENTE';
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'situacao', CASE WHEN v_inseridos=1 THEN 'REGISTRADA' ELSE 'JA_REGISTRADA' END,
    'evento_id_historico', p_evento_id_historico,
    'evento_id_observado', p_evento_id_observado,
    'fim_observado', p_fim_observado);
END
$body$;
REVOKE ALL ON FUNCTION public.registrar_fim_complementar_motoristas_sso(
  text, text, timestamp without time zone, timestamp with time zone
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_fim_complementar_motoristas_sso(
  text, text, timestamp without time zone, timestamp with time zone
) TO service_role;
COMMIT;
