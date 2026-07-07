-- =============================================================================
-- Obrador — Enduriment de RLS i operacions staff
-- =============================================================================
-- Objectius:
-- 1. Evitar que qualsevol authenticated tingui CRUD total sobre obrador.
-- 2. Permetre ús al backoffice (admin/management/manager).
-- 3. Permetre el portal staff compartit només en els fluxos necessaris.
-- 4. Moure la confirmació d'entrega a RPC per no fer UPDATE directe.
-- =============================================================================

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS disabled BOOLEAN DEFAULT FALSE;

CREATE OR REPLACE FUNCTION public.obrador_is_management_user()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_disabled boolean;
BEGIN
  SELECT lower(coalesce(role, '')), coalesce(disabled, false)
  INTO v_role, v_disabled
  FROM public.user_profiles
  WHERE id = auth.uid();

  RETURN NOT coalesce(v_disabled, false)
    AND v_role IN ('admin', 'management', 'manager');
END;
$$;

CREATE OR REPLACE FUNCTION public.obrador_is_portal_staff_user()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_email text;
  v_disabled boolean;
BEGIN
  SELECT lower(coalesce(role, '')), lower(coalesce(email, '')), coalesce(disabled, false)
  INTO v_role, v_email, v_disabled
  FROM public.user_profiles
  WHERE id = auth.uid();

  IF coalesce(v_disabled, false) THEN
    RETURN false;
  END IF;

  RETURN v_role IN ('admin', 'management', 'manager')
    OR v_email = 'obrador.transport@solucionssocials.org';
END;
$$;

REVOKE ALL ON FUNCTION public.obrador_is_management_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.obrador_is_portal_staff_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.obrador_is_management_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.obrador_is_portal_staff_user() TO authenticated;

CREATE OR REPLACE FUNCTION public.obrador_marcar_expedicio_entregada(
  p_id uuid,
  p_check_client boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expedicio obrador_expedicions%ROWTYPE;
BEGIN
  IF NOT public.obrador_is_portal_staff_user() THEN
    RAISE EXCEPTION 'No tens permisos per marcar entregues d''obrador.';
  END IF;

  UPDATE obrador_expedicions
  SET estat = 'entregat',
      check_client = coalesce(p_check_client, false),
      updated_at = now()
  WHERE id = p_id
  RETURNING * INTO v_expedicio;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Expedició no trobada';
  END IF;

  RETURN to_jsonb(v_expedicio);
END;
$$;

REVOKE ALL ON FUNCTION public.obrador_marcar_expedicio_entregada(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.obrador_marcar_expedicio_entregada(uuid, boolean) TO authenticated;

DO $$
DECLARE
  t text;
  pol text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'obrador_proveidors', 'obrador_recepcions', 'obrador_productes', 'obrador_operaris',
    'obrador_lots', 'obrador_etiquetes', 'obrador_expedicions', 'obrador_incidencies',
    'obrador_temperatures'
  ]
  LOOP
    FOREACH pol IN ARRAY ARRAY['select', 'insert', 'update', 'delete']
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_' || pol, t);
    END LOOP;
  END LOOP;
END $$;

DROP POLICY IF EXISTS obrador_proveidors_select_staff ON obrador_proveidors;
CREATE POLICY obrador_proveidors_select_staff ON obrador_proveidors
  FOR SELECT TO authenticated
  USING (public.obrador_is_portal_staff_user());

DROP POLICY IF EXISTS obrador_proveidors_write_management ON obrador_proveidors;
CREATE POLICY obrador_proveidors_write_management ON obrador_proveidors
  FOR ALL TO authenticated
  USING (public.obrador_is_management_user())
  WITH CHECK (public.obrador_is_management_user());

DROP POLICY IF EXISTS obrador_productes_select_management ON obrador_productes;
CREATE POLICY obrador_productes_select_management ON obrador_productes
  FOR SELECT TO authenticated
  USING (public.obrador_is_management_user());

DROP POLICY IF EXISTS obrador_productes_write_management ON obrador_productes;
CREATE POLICY obrador_productes_write_management ON obrador_productes
  FOR ALL TO authenticated
  USING (public.obrador_is_management_user())
  WITH CHECK (public.obrador_is_management_user());

DROP POLICY IF EXISTS obrador_operaris_select_management ON obrador_operaris;
CREATE POLICY obrador_operaris_select_management ON obrador_operaris
  FOR SELECT TO authenticated
  USING (public.obrador_is_management_user());

DROP POLICY IF EXISTS obrador_operaris_write_management ON obrador_operaris;
CREATE POLICY obrador_operaris_write_management ON obrador_operaris
  FOR ALL TO authenticated
  USING (public.obrador_is_management_user())
  WITH CHECK (public.obrador_is_management_user());

DROP POLICY IF EXISTS obrador_recepcions_select_management ON obrador_recepcions;
CREATE POLICY obrador_recepcions_select_management ON obrador_recepcions
  FOR SELECT TO authenticated
  USING (public.obrador_is_management_user());

DROP POLICY IF EXISTS obrador_recepcions_insert_staff ON obrador_recepcions;
CREATE POLICY obrador_recepcions_insert_staff ON obrador_recepcions
  FOR INSERT TO authenticated
  WITH CHECK (public.obrador_is_portal_staff_user());

DROP POLICY IF EXISTS obrador_recepcions_update_management ON obrador_recepcions;
CREATE POLICY obrador_recepcions_update_management ON obrador_recepcions
  FOR UPDATE TO authenticated
  USING (public.obrador_is_management_user())
  WITH CHECK (public.obrador_is_management_user());

DROP POLICY IF EXISTS obrador_recepcions_delete_management ON obrador_recepcions;
CREATE POLICY obrador_recepcions_delete_management ON obrador_recepcions
  FOR DELETE TO authenticated
  USING (public.obrador_is_management_user());

DROP POLICY IF EXISTS obrador_lots_select_staff ON obrador_lots;
CREATE POLICY obrador_lots_select_staff ON obrador_lots
  FOR SELECT TO authenticated
  USING (public.obrador_is_portal_staff_user());

DROP POLICY IF EXISTS obrador_lots_write_management ON obrador_lots;
CREATE POLICY obrador_lots_write_management ON obrador_lots
  FOR ALL TO authenticated
  USING (public.obrador_is_management_user())
  WITH CHECK (public.obrador_is_management_user());

DROP POLICY IF EXISTS obrador_etiquetes_select_staff ON obrador_etiquetes;
CREATE POLICY obrador_etiquetes_select_staff ON obrador_etiquetes
  FOR SELECT TO authenticated
  USING (public.obrador_is_portal_staff_user());

DROP POLICY IF EXISTS obrador_etiquetes_write_management ON obrador_etiquetes;
CREATE POLICY obrador_etiquetes_write_management ON obrador_etiquetes
  FOR ALL TO authenticated
  USING (public.obrador_is_management_user())
  WITH CHECK (public.obrador_is_management_user());

DROP POLICY IF EXISTS obrador_expedicions_select_staff ON obrador_expedicions;
CREATE POLICY obrador_expedicions_select_staff ON obrador_expedicions
  FOR SELECT TO authenticated
  USING (public.obrador_is_portal_staff_user());

DROP POLICY IF EXISTS obrador_expedicions_delete_management ON obrador_expedicions;
CREATE POLICY obrador_expedicions_delete_management ON obrador_expedicions
  FOR DELETE TO authenticated
  USING (public.obrador_is_management_user());

DROP POLICY IF EXISTS obrador_incidencies_select_management ON obrador_incidencies;
CREATE POLICY obrador_incidencies_select_management ON obrador_incidencies
  FOR SELECT TO authenticated
  USING (public.obrador_is_management_user());

DROP POLICY IF EXISTS obrador_incidencies_write_management ON obrador_incidencies;
CREATE POLICY obrador_incidencies_write_management ON obrador_incidencies
  FOR ALL TO authenticated
  USING (public.obrador_is_management_user())
  WITH CHECK (public.obrador_is_management_user());

DROP POLICY IF EXISTS obrador_temperatures_select_management ON obrador_temperatures;
CREATE POLICY obrador_temperatures_select_management ON obrador_temperatures
  FOR SELECT TO authenticated
  USING (public.obrador_is_management_user());

DROP POLICY IF EXISTS obrador_temperatures_write_management ON obrador_temperatures;
CREATE POLICY obrador_temperatures_write_management ON obrador_temperatures
  FOR ALL TO authenticated
  USING (public.obrador_is_management_user())
  WITH CHECK (public.obrador_is_management_user());
