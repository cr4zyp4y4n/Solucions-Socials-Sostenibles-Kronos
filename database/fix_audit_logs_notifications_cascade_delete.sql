-- Corrige las foreign keys de audit_logs y notifications a auth.users para que
-- usen ON DELETE CASCADE. Así, cuando se elimine un usuario (p. ej. por el
-- trigger en user_profiles o por la RPC complete_delete_user_cascade), las filas
-- que lo referencian se eliminan automáticamente y no bloquean el DELETE.
--
-- Ejecutar en el SQL Editor de Supabase.
-- Si el nombre de la constraint difiere, comprobar con:
--   SELECT conname FROM pg_constraint WHERE conrelid = 'public.audit_logs'::regclass;

-- 1. audit_logs.user_id -> auth.users(id)
ALTER TABLE public.audit_logs
  DROP CONSTRAINT IF EXISTS audit_logs_user_id_fkey;

ALTER TABLE public.audit_logs
  ADD CONSTRAINT audit_logs_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

-- 2. notifications.recipient_id -> auth.users(id)
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_recipient_id_fkey;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_recipient_id_fkey
  FOREIGN KEY (recipient_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

-- 3. notifications.sender_id -> auth.users(id)
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_sender_id_fkey;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_sender_id_fkey
  FOREIGN KEY (sender_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;
