-- =============================================================================
-- Plans d'higiene des del portal (mòbil / tauleta)
-- El compte compartit del portal pot crear el registre i obrir la incidència.
-- No pot esborrar-lo ni canviar el que ja ha signat: només lligar la incidència.
-- Executar després de database/alter_obrador_registres_higiene.sql
-- =============================================================================

DROP POLICY IF EXISTS obrador_registres_torn_insert_staff ON public.obrador_registres_torn;
CREATE POLICY obrador_registres_torn_insert_staff ON public.obrador_registres_torn
  FOR INSERT TO authenticated
  WITH CHECK (public.obrador_is_portal_staff_user());

DROP POLICY IF EXISTS obrador_registres_torn_update_staff ON public.obrador_registres_torn;
CREATE POLICY obrador_registres_torn_update_staff ON public.obrador_registres_torn
  FOR UPDATE TO authenticated
  USING (public.obrador_is_portal_staff_user())
  WITH CHECK (public.obrador_is_portal_staff_user());

COMMENT ON POLICY obrador_registres_torn_insert_staff ON public.obrador_registres_torn IS
  'El personal del portal signa el registre del dia des del mòbil.';
COMMENT ON POLICY obrador_registres_torn_update_staff ON public.obrador_registres_torn IS
  'El portal només pot enganxar la incidència. El disparador impedeix reescriure el registre.';

CREATE OR REPLACE FUNCTION public.obrador_registres_torn_limitar_portal()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF public.obrador_is_management_user() THEN
    RETURN NEW;
  END IF;

  IF NOT public.obrador_is_portal_staff_user() THEN
    RAISE EXCEPTION 'Sense permís per modificar el registre.';
  END IF;

  IF NEW.data IS DISTINCT FROM OLD.data
    OR NEW.tipus_codi IS DISTINCT FROM OLD.tipus_codi
    OR NEW.items IS DISTINCT FROM OLD.items
    OR NEW.detall IS DISTINCT FROM OLD.detall
    OR coalesce(NEW.observacions, '') IS DISTINCT FROM coalesce(OLD.observacions, '')
    OR NEW.id_operari IS DISTINCT FROM OLD.id_operari
    OR NEW.codi_fichatge IS DISTINCT FROM OLD.codi_fichatge
    OR NEW.nom_operari IS DISTINCT FROM OLD.nom_operari
    OR NEW.origen_extern IS DISTINCT FROM OLD.origen_extern
    OR NEW.document_adjunt_path IS DISTINCT FROM OLD.document_adjunt_path
  THEN
    RAISE EXCEPTION 'Des del portal només es pot lligar la incidència al registre ja signat.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_obrador_registres_torn_limitar_portal ON public.obrador_registres_torn;
CREATE TRIGGER trg_obrador_registres_torn_limitar_portal
  BEFORE UPDATE ON public.obrador_registres_torn
  FOR EACH ROW
  EXECUTE FUNCTION public.obrador_registres_torn_limitar_portal();

DROP POLICY IF EXISTS obrador_incidencies_insert_staff_registre ON public.obrador_incidencies;
CREATE POLICY obrador_incidencies_insert_staff_registre ON public.obrador_incidencies
  FOR INSERT TO authenticated
  WITH CHECK (
    public.obrador_is_portal_staff_user()
    AND origen = 'registre'
    AND id_registre IS NOT NULL
  );

DROP POLICY IF EXISTS obrador_incidencies_select_staff_registre ON public.obrador_incidencies;
CREATE POLICY obrador_incidencies_select_staff_registre ON public.obrador_incidencies
  FOR SELECT TO authenticated
  USING (
    public.obrador_is_portal_staff_user()
    AND origen = 'registre'
  );

COMMENT ON POLICY obrador_incidencies_insert_staff_registre ON public.obrador_incidencies IS
  'El portal obre una incidència només lligada a un registre d''higiene. No tanca ni revisa.';
