-- Portal SSO / Celeo: contrato de complementacao de fim de viagem.
-- Validado no Supabase HML ckfsarzmudwdehiiltwi em 2026-11-13.
-- USO: revisao/versionamento na branch fix/historico-fim-nulo-20261113.
-- NAO EXECUTAR EM PROD sem nova autorizacao, PR aprovado e homologacao do codigo.
-- Nao modifica fato_motoristas_viagens nem a RPC de insercao existente.
BEGIN;
DO $pre$
BEGIN
  IF to_regnamespace('sso_private') IS NOT NULL
     OR to_regclass('sso_private.motoristas_viagens_fim_complementar') IS NOT NULL
     OR EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
                WHERE n.nspname='public' AND p.proname='registrar_fim_complementar_motoristas_sso') THEN
    RAISE EXCEPTION 'OBJETO_HML_JA_EXISTE: nao sobrescrever';
  END IF;
END
$pre$;
CREATE SCHEMA sso_private;
REVOKE ALL ON SCHEMA sso_private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA sso_private TO service_role;

CREATE TABLE sso_private.motoristas_viagens_fim_complementar (
  evento_id_historico text PRIMARY KEY REFERENCES public.fato_motoristas_viagens(evento_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  evento_id_observado text NOT NULL UNIQUE,
  vehicle_id_cobli text NOT NULL,
  inicio timestamp without time zone NOT NULL,
  fim_observado timestamp without time zone NOT NULL,
  extraido_em_utc timestamp with time zone NOT NULL,
  registrado_em timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT fim_complementar_id_historico_valido CHECK (evento_id_historico ~ '^[0-9a-f]{64}$'),
  CONSTRAINT fim_complementar_id_observado_valido CHECK (evento_id_observado ~ '^[0-9a-f]{64}$'),
  CONSTRAINT fim_complementar_ids_distintos CHECK (evento_id_historico <> evento_id_observado),
  CONSTRAINT fim_complementar_positivo CHECK (fim_observado > inicio),
  CONSTRAINT fim_complementar_veiculo_nao_vazio CHECK (length(btrim(vehicle_id_cobli)) > 0)
);
ALTER TABLE sso_private.motoristas_viagens_fim_complementar ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE sso_private.motoristas_viagens_fim_complementar FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON TABLE sso_private.motoristas_viagens_fim_complementar TO service_role;

CREATE FUNCTION sso_private.rejeitar_modificacao_fim_complementar()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $body$
BEGIN
  RAISE EXCEPTION 'REGISTRO_COMPLEMENTAR_IMUTAVEL';
END
$body$;
REVOKE ALL ON FUNCTION sso_private.rejeitar_modificacao_fim_complementar() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_fim_complementar_imutavel
BEFORE UPDATE OR DELETE ON sso_private.motoristas_viagens_fim_complementar
FOR EACH ROW EXECUTE FUNCTION sso_private.rejeitar_modificacao_fim_complementar();

CREATE FUNCTION public.registrar_fim_complementar_motoristas_sso(
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
