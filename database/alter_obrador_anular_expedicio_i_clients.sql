-- =============================================================================
-- Obrador: anular expedició (en trànsit) + mestre de clients
-- =============================================================================

-- 1) Clients (autocompletat / mestre lleuger)
CREATE TABLE IF NOT EXISTS public.obrador_clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nom TEXT NOT NULL,
  codi TEXT,
  actiu BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT obrador_clients_nom_unique UNIQUE (nom)
);

CREATE INDEX IF NOT EXISTS idx_obrador_clients_actiu_nom
  ON public.obrador_clients (actiu, nom);

ALTER TABLE public.obrador_clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS obrador_clients_select_staff ON public.obrador_clients;
CREATE POLICY obrador_clients_select_staff ON public.obrador_clients
  FOR SELECT TO authenticated
  USING (
    public.obrador_is_management_user()
    OR public.obrador_is_portal_staff_user()
  );

DROP POLICY IF EXISTS obrador_clients_write_mgmt ON public.obrador_clients;
CREATE POLICY obrador_clients_write_mgmt ON public.obrador_clients
  FOR ALL TO authenticated
  USING (public.obrador_is_management_user())
  WITH CHECK (public.obrador_is_management_user());

-- Seed des d'expedicions existents
INSERT INTO public.obrador_clients (nom)
SELECT DISTINCT btrim(id_client)
FROM public.obrador_expedicions
WHERE id_client IS NOT NULL AND btrim(id_client) <> ''
ON CONFLICT (nom) DO NOTHING;

-- Upsert client (management o portal staff)
CREATE OR REPLACE FUNCTION public.obrador_upsert_client(p_nom text, p_codi text DEFAULT NULL)
RETURNS public.obrador_clients
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nom text := NULLIF(btrim(COALESCE(p_nom, '')), '');
  v_row public.obrador_clients%ROWTYPE;
BEGIN
  IF v_nom IS NULL THEN
    RAISE EXCEPTION 'El nom del client és obligatori.';
  END IF;

  IF NOT (
    public.obrador_is_management_user()
    OR public.obrador_is_portal_staff_user()
  ) THEN
    RAISE EXCEPTION 'No autoritzat';
  END IF;

  INSERT INTO public.obrador_clients (nom, codi, actiu, updated_at)
  VALUES (v_nom, NULLIF(btrim(COALESCE(p_codi, '')), ''), true, now())
  ON CONFLICT (nom) DO UPDATE
    SET
      codi = COALESCE(EXCLUDED.codi, public.obrador_clients.codi),
      actiu = true,
      updated_at = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.obrador_upsert_client(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.obrador_upsert_client(text, text) TO authenticated;

-- 2) Anular expedició en trànsit → lot torna a envasat
CREATE OR REPLACE FUNCTION public.obrador_anular_expedicio(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exp public.obrador_expedicions%ROWTYPE;
  v_lot public.obrador_lots%ROWTYPE;
BEGIN
  IF NOT public.obrador_is_management_user() THEN
    RAISE EXCEPTION 'Només management pot anul·lar expedicions.';
  END IF;

  SELECT *
  INTO v_exp
  FROM public.obrador_expedicions
  WHERE id = p_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Expedició no trobada';
  END IF;

  IF COALESCE(v_exp.estat, '') = 'entregat' THEN
    RAISE EXCEPTION 'No es pot anul·lar una expedició ja entregada.';
  END IF;

  SELECT *
  INTO v_lot
  FROM public.obrador_lots
  WHERE id = v_exp.id_lot
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lot no trobat';
  END IF;

  DELETE FROM public.obrador_expedicions WHERE id = p_id;

  UPDATE public.obrador_lots
  SET estat = 'envasat',
      updated_at = now()
  WHERE id = v_lot.id
  RETURNING * INTO v_lot;

  RETURN jsonb_build_object(
    'anulada', true,
    'id_expedicio', p_id,
    'lot', to_jsonb(v_lot)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.obrador_anular_expedicio(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.obrador_anular_expedicio(uuid) TO authenticated;
