-- =============================================================================
-- Cron: obrador-sensors-watchdog cada 15 min (sense senyal APPCC)
--
-- Requisits:
-- 1) Executar create_obrador_sensors_iot.sql
-- 2) Desplegar Edge Function `obrador-sensors-watchdog`
-- 3) Vault amb project_url + service_role_key (igual que fichaje-sms)
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'obrador-sensors-watchdog-cada-15min';

SELECT cron.schedule(
  'obrador-sensors-watchdog-cada-15min',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
           || '/functions/v1/obrador-sensors-watchdog',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
    ),
    body := jsonb_build_object('source', 'pg_cron', 'at', now())
  ) AS request_id;
  $$
);

-- Verificar:
-- SELECT * FROM cron.job WHERE jobname = 'obrador-sensors-watchdog-cada-15min';
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;
