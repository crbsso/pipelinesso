-- PORTAL SSO / CELEO - ETAPA 26 - LEITURA EFETIVA HML v1.0
-- Alvo exclusivo: Supabase HML ckfsarzmudwdehiiltwi.
-- Instalado e validado em HML em 13/11/2026; NAO REEXECUTAR.
-- PROD, view operacional, fato historico e publicador de INSERT permanecem inalterados.
-- Para rollback exclusivamente da view: DROP VIEW sso_private.vw_motoristas_viagens_fim_efetivo RESTRICT;
BEGIN;
DO $pre$
BEGIN
  IF to_regclass('sso_private.motoristas_viagens_fim_complementar') IS NULL
     OR to_regclass('sso_private.vw_motoristas_viagens_fim_efetivo') IS NOT NULL
     OR (SELECT count(*) FROM sso_private.motoristas_viagens_fim_complementar) <> 0
     OR (SELECT count(*) FROM public.fato_motoristas_viagens) <> 5584
     OR (SELECT count(*) FROM public.stg_backfill_motoristas_viagens_sso) <> 0
  THEN
    RAISE EXCEPTION 'PRECONDICOES_LEITURA_HML_DIVERGENTES';
  END IF;
END
$pre$;

CREATE VIEW sso_private.vw_motoristas_viagens_fim_efetivo
WITH (security_invoker = true) AS
SELECT
  f.evento_id AS evento_id_historico,
  f.vehicle_id_cobli,
  f.tipo_evento,
  f.inicio,
  f.fim AS fim_original,
  COALESCE(f.fim, c.fim_observado) AS fim_efetivo,
  (c.evento_id_historico IS NOT NULL) AS complementado,
  c.evento_id_observado,
  c.extraido_em_utc AS extracao_complementar_utc
FROM public.fato_motoristas_viagens AS f
LEFT JOIN sso_private.motoristas_viagens_fim_complementar AS c
  ON c.evento_id_historico = f.evento_id;

REVOKE ALL ON TABLE sso_private.vw_motoristas_viagens_fim_efetivo
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE sso_private.vw_motoristas_viagens_fim_efetivo
  TO service_role;
COMMIT;
