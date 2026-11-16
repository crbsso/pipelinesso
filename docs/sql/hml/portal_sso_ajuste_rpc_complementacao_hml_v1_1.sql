-- Portal SSO / Celeo - etapa 26. Ajuste restrito de RPC complementar, HML.
-- Ambiente autorizado: ckfsarzmudwdehiiltwi. NAO EXECUTAR EM PROD.
-- Preserva tabela sso_private.motoristas_viagens_fim_complementar,
-- fato_motoristas_viagens e RPC historica de INSERT.
-- Contrato: SHA256 da serializacao canonica Python da identidade:
-- {"fim":"ISO","inicio":"ISO","tipo_evento":"VIAGEM","vehicle_id_cobli":"..."}.
-- Formatos ISO locais permitidos: YYYY-MM-DDTHH:MM:SS e fracoes de 1 a 6 digitos.
-- Representacoes alternativas de fuso nao sao aceitas; falhar fechado.
-- Reprocessamento identico: id, fim, veiculo e inicio identicos;
-- a primeira data de observacao e preservada, mesmo se uma nova extracao for posterior.

BEGIN;
DO $pre$
BEGIN
    IF to_regclass('sso_private.motoristas_viagens_fim_complementar') IS NULL
       OR NOT EXISTS (
           SELECT 1 FROM pg_proc
           WHERE oid = 'public.registrar_fim_complementar_motoristas_sso(text,text,timestamp without time zone,timestamp with time zone)'::regprocedure
       )
       OR (SELECT count(*) FROM sso_private.motoristas_viagens_fim_complementar) <> 0
       OR (SELECT count(*) FROM public.stg_backfill_motoristas_viagens_sso) <> 0
       OR position(
         'v_complemento.extraido_em_utc IS DISTINCT FROM p_extraido_em_utc'
         IN pg_get_functiondef(
            'public.registrar_fim_complementar_motoristas_sso(text,text,timestamp without time zone,timestamp with time zone)'::regprocedure
         )) = 0
    THEN
        RAISE EXCEPTION 'HML_CONTRATO_PRECONDICOES_NAO_ATENDIDAS';
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
  v_precision_inicio integer;
  v_precision_fim integer;
  v_inicio_raw text;
  v_fim_raw text;
  v_canonico text;
  v_hash text;
  v_hash_valido boolean := false;
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

  SELECT f.evento_id, f.vehicle_id_cobli, f.tipo_evento,
         f.inicio, f.fim, f.extraido_em_utc
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
  IF EXISTS (SELECT 1 FROM public.fato_motoristas_viagens AS f
             WHERE f.evento_id = p_evento_id_observado) THEN
    RAISE EXCEPTION 'EVENTO_OBSERVADO_JA_PUBLICADO';
  END IF;

  -- Reconstruir exatamente a identidade SHA-256 do codigo Python, nao apenas
  -- verificar o formato hex. Testa apenas ISO local com precisao 0..6.
  -- Timestamps sao recuperados do historico protegido / parametro tipado,
  -- logo o solicitante nao fornece outra identidade de veiculo ou inicio.
  FOR v_precision_inicio IN 0..6 LOOP
    v_inicio_raw := pg_catalog.to_char(
      v_original.inicio, 'YYYY-MM-DD"T"HH24:MI:SS');
    IF v_precision_inicio > 0 THEN
      v_inicio_raw := v_inicio_raw || '.' ||
        pg_catalog.substr(pg_catalog.to_char(v_original.inicio, 'US'),
                          1, v_precision_inicio);
    END IF;
    IF v_inicio_raw::timestamp IS DISTINCT FROM v_original.inicio THEN
      CONTINUE;
    END IF;
    FOR v_precision_fim IN 0..6 LOOP
      v_fim_raw := pg_catalog.to_char(
        p_fim_observado, 'YYYY-MM-DD"T"HH24:MI:SS');
      IF v_precision_fim > 0 THEN
        v_fim_raw := v_fim_raw || '.' ||
          pg_catalog.substr(pg_catalog.to_char(p_fim_observado, 'US'),
                            1, v_precision_fim);
      END IF;
      IF v_fim_raw::timestamp IS DISTINCT FROM p_fim_observado THEN
        CONTINUE;
      END IF;
      v_canonico := '{"fim":' || pg_catalog.to_json(v_fim_raw)::text
        || ',"inicio":' || pg_catalog.to_json(v_inicio_raw)::text
        || ',"tipo_evento":"VIAGEM","vehicle_id_cobli":'
        || pg_catalog.to_json(v_original.vehicle_id_cobli)::text || '}';
      v_hash := pg_catalog.encode(
        extensions.digest(pg_catalog.convert_to(v_canonico, 'UTF8'), 'sha256'),
        'hex');
      IF v_hash = p_evento_id_observado THEN
        v_hash_valido := true;
        EXIT;
      END IF;
    END LOOP;
    EXIT WHEN v_hash_valido;
  END LOOP;
  IF NOT v_hash_valido THEN
    RAISE EXCEPTION 'IDENTIDADE_HASH_DIVERGENTE';
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
     OR v_complemento.vehicle_id_cobli IS DISTINCT FROM v_original.vehicle_id_cobli
     OR v_complemento.inicio IS DISTINCT FROM v_original.inicio THEN
    RAISE EXCEPTION 'COMPLEMENTACAO_EXISTENTE_DIVERGENTE';
  END IF;

  -- A primeira data de extracao da complementacao permanece imutavel;
  -- reprocessamentos identicos podem ter data de extracao posterior.
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
