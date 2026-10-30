-- =============================================================================
-- Cron: licitacions-sync diari ~07:15 Europe/Madrid
--
-- pg_cron va en UTC:
--   Hivern (CET = UTC+1): 07:15 Madrid = 06:15 UTC → '15 6 * * *'
--   Estiu  (CEST = UTC+2): 07:15 Madrid = 05:15 UTC → '15 5 * * *'
--
-- Per no perdre el canvi d'hora, es programa '15 5,6 * * *' i la Edge Function
-- té un guard "already_ran_today" (origen=edge) per no executar dos cops el mateix dia.
--
-- Requisits:
-- 1) Executar database/alter_licitacions_circuit_v2.sql
-- 2) Desplegar Edge Function `licitacions-sync`
--    supabase functions deploy licitacions-sync
-- 3) Vault amb project_url + service_role_key (igual que obrador-sensors / fichaje-sms)
--
-- Quan porti ≥1 setmana estable en producció: es pot desactivar el cron
-- setmanal d'Electron a src/main.js (deixar només el botó manual origen=manual).
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'licitacions-sync-diari-0715-madrid';

SELECT cron.schedule(
  'licitacions-sync-diari-0715-madrid',
  '15 5,6 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
           || '/functions/v1/licitacions-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
    ),
    body := jsonb_build_object('source', 'pg_cron', 'at', now())
  ) AS request_id;
  $$
);

-- Verificar:
-- SELECT * FROM cron.job WHERE jobname = 'licitacions-sync-diari-0715-madrid';
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;
-- SELECT * FROM public.licitacions_sync_log WHERE origen = 'edge' ORDER BY started_at DESC LIMIT 10;

-- Prova manual (force=true salta el guard del dia):
-- SELECT net.http_post(
--   url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
--          || '/functions/v1/licitacions-sync',
--   headers := jsonb_build_object(
--     'Content-Type', 'application/json',
--     'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
--   ),
--   body := jsonb_build_object('force', true, 'source', 'manual_sql')
-- );
