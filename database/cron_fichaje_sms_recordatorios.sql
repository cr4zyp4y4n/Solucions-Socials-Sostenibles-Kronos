-- =====================================================
-- Cron: invocar Edge Function fichaje-sms-recordatorios
-- Cada 5 minutos (UTC). La function calcula hora Europe/Madrid.
-- =====================================================
-- Requisitos previos:
-- 1) Ejecutar create_fichajes_sms_recordatorios.sql
-- 2) Desplegar la Edge Function `fichaje-sms-recordatorios`
-- 3) Secrets de la function:
--      FIRMA_SMS_API_BASE = https://firma.solucionssocials.org
--      FIRMA_SMS_API_SECRET = (mismo que portal-firma)
-- 4) Guardar en Vault (Dashboard → Project Settings → Vault o SQL abajo):
--      project_url, service_role_key
--
-- Sustituye PROJECT_REF y la service_role key reales, o usa Vault.
-- =====================================================

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- --- Opción A: secrets en Vault (recomendado) ---
-- select vault.create_secret('https://zalnsacawwekmibhoiba.supabase.co', 'project_url');
-- select vault.create_secret('TU_SERVICE_ROLE_KEY', 'service_role_key');

-- Desprogramar si ya existía
SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'fichaje-sms-recordatorios-cada-5min';

-- Programar cada 5 minutos
SELECT cron.schedule(
  'fichaje-sms-recordatorios-cada-5min',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
           || '/functions/v1/fichaje-sms-recordatorios',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
    ),
    body := jsonb_build_object('source', 'pg_cron', 'at', now())
  ) AS request_id;
  $$
);

-- Verificar:
-- SELECT * FROM cron.job WHERE jobname = 'fichaje-sms-recordatorios-cada-5min';
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;
