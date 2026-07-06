-- Compte compartit Portal Obrador (transport / catering / obrador)
-- Executar al SQL Editor de Supabase (com a postgres / service role).
--
-- ABANS D'EXECUTAR:
--   1. Canvia user_email i user_password (línies ~20-21).
--   2. Opcional: canvia user_name.
--
-- Crea:
--   - auth.users (login email + contrasenya)
--   - auth.identities (necessari per iniciar sessió)
--   - public.user_profiles (perfil Kronos; també el trigger handle_new_user si actiu)
--
-- Si l'email ja existeix, el script no fa res (idempotent).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  -- ═══ EDITAR AQUÍ ═══
  user_email    text := 'obrador.transport@solucionssocials.org';
  user_password text := 'transport2026Obrador';
  user_name     text := 'Portal Obrador / Transport';
  -- ═══════════════════

  new_user_id   uuid;
  existing_id   uuid;
BEGIN
  IF user_password = 'caraculobergasola' THEN
    RAISE EXCEPTION 'Canvia user_password al script abans d''executar-lo.';
  END IF;

  SELECT id INTO existing_id FROM auth.users WHERE lower(email) = lower(user_email) LIMIT 1;

  IF existing_id IS NOT NULL THEN
    RAISE NOTICE 'L''usuari % ja existeix (id: %). No s''ha creat de nou.', user_email, existing_id;

    INSERT INTO public.user_profiles (id, name, role, email, disabled)
    VALUES (existing_id, user_name, 'user', user_email, false)
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      email = EXCLUDED.email,
      disabled = COALESCE(public.user_profiles.disabled, false),
      updated_at = NOW();

    RETURN;
  END IF;

  new_user_id := gen_random_uuid();

  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    invited_at,
    confirmation_token,
    confirmation_sent_at,
    recovery_token,
    recovery_sent_at,
    email_change_token_new,
    email_change,
    email_change_sent_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    created_at,
    updated_at,
    phone,
    phone_confirmed_at,
    phone_change,
    phone_change_token,
    phone_change_sent_at,
    email_change_token_current,
    email_change_confirm_status,
    banned_until,
    reauthentication_token,
    reauthentication_sent_at,
    is_sso_user,
    deleted_at
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    new_user_id,
    'authenticated',
    'authenticated',
    user_email,
    crypt(user_password, gen_salt('bf')),
    NOW(),
    NULL,
    '',
    NULL,
    '',
    NULL,
    '',
    '',
    NULL,
    NOW(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('name', user_name, 'role', 'user'),
    FALSE,
    NOW(),
    NOW(),
    NULL,
    NULL,
    '',
    '',
    NULL,
    '',
    0,
    NULL,
    '',
    NULL,
    FALSE,
    NULL
  );

  INSERT INTO auth.identities (
    id,
    user_id,
    provider_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    new_user_id,
    new_user_id::text,
    jsonb_build_object(
      'sub', new_user_id::text,
      'email', user_email,
      'email_verified', true,
      'phone_verified', false
    ),
    'email',
    NOW(),
    NOW(),
    NOW()
  );

  INSERT INTO public.user_profiles (id, name, role, email, disabled)
  VALUES (new_user_id, user_name, 'user', user_email, false)
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    updated_at = NOW();

  RAISE NOTICE 'Usuari creat correctament: % (id: %)', user_email, new_user_id;
  RAISE NOTICE 'Prova login al portal: https://portalobrador.netlify.app';
END $$;

-- Comprovació (ha de retornar 1 fila amb perfil)
SELECT
  au.id,
  au.email,
  au.email_confirmed_at IS NOT NULL AS email_confirmat,
  up.name,
  up.role,
  COALESCE(up.disabled, false) AS disabled
FROM auth.users au
LEFT JOIN public.user_profiles up ON up.id = au.id
WHERE lower(au.email) = lower('obrador.transport@solucionssocials.org');
