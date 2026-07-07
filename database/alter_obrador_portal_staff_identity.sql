-- =============================================================================
-- Obrador — Identitat explícita per al staff del portal
-- =============================================================================
-- Evita dependre d'un email hardcodejat dins les polítiques RLS.
-- Marca el compte compartit (o altres comptes operatius) amb una bandera
-- específica a user_profiles.
-- =============================================================================

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS obrador_portal_staff BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_user_profiles_obrador_portal_staff
  ON public.user_profiles(obrador_portal_staff);

CREATE OR REPLACE FUNCTION public.obrador_is_portal_staff_user()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_disabled boolean;
  v_portal_staff boolean;
BEGIN
  SELECT
    lower(coalesce(role, '')),
    coalesce(disabled, false),
    coalesce(obrador_portal_staff, false)
  INTO v_role, v_disabled, v_portal_staff
  FROM public.user_profiles
  WHERE id = auth.uid();

  IF coalesce(v_disabled, false) THEN
    RETURN false;
  END IF;

  RETURN v_role IN ('admin', 'management', 'manager')
    OR coalesce(v_portal_staff, false);
END;
$$;

REVOKE ALL ON FUNCTION public.obrador_is_portal_staff_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.obrador_is_portal_staff_user() TO authenticated;
