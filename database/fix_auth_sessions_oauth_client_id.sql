-- =============================================================================
-- FIX: Error 500 al refrescar sesión - "missing destination name oauth_client_id in *models.Session"
-- =============================================================================
-- Causa: Bug conocido de Supabase Auth. La columna oauth_client_id existe en
-- auth.sessions pero GoTrue no la rellena. auth.sessions tiene FK a auth.oauth_clients.
-- Si oauth_clients está vacía, hay que crear primero un cliente "por defecto".
--
-- CÓMO EJECUTAR (en este orden en SQL Editor):
-- =============================================================================

-- -----------------------------------------------------------------------------
-- OPCIONAL: Ver estructura de auth.oauth_clients (por si el INSERT falla)
-- -----------------------------------------------------------------------------
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_schema = 'auth' AND table_name = 'oauth_clients'
-- ORDER BY ordinal_position;

-- -----------------------------------------------------------------------------
-- PASO A: Si auth.oauth_clients está VACÍA, insertar un cliente por defecto.
--         (Ejecutar solo UNA vez; si ya hay filas, saltar al PASO B.)
-- Estructura real: id, client_secret_hash, registration_type, redirect_uris,
-- grant_types, client_name, client_uri, logo_uri, created_at, updated_at, deleted_at, client_type
-- -----------------------------------------------------------------------------
-- Para ver TODOS los enums del schema auth (ejecutar si falla el INSERT):
--   SELECT n.nspname, t.typname, e.enumlabel FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid JOIN pg_namespace n ON t.typnamespace = n.oid WHERE n.nspname = 'auth' ORDER BY t.typname, e.enumsortorder;
INSERT INTO auth.oauth_clients (
  id,
  client_secret_hash,
  registration_type,
  redirect_uris,
  grant_types,
  client_name,
  client_uri,
  logo_uri,
  created_at,
  updated_at,
  client_type
)
VALUES (
  '00000000-0000-0000-0000-000000000000'::uuid,
  NULL,
  'manual'::auth.oauth_registration_type,
  'http://localhost',
  'refresh_token',
  'Default (email/password)',
  NULL,
  NULL,
  now(),
  now(),
  'confidential'::auth.oauth_client_type
)
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- PASO B: Rellenar oauth_client_id en sesiones donde es NULL
-- -----------------------------------------------------------------------------
UPDATE auth.sessions
SET oauth_client_id = '00000000-0000-0000-0000-000000000000'::uuid
WHERE oauth_client_id IS NULL;
