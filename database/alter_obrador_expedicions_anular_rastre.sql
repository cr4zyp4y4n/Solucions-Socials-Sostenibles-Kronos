-- =============================================================================
-- Anul·lar una expedició deixa rastre. La fila no s'esborra.
-- Executar a SQL Editor (idempotent)
-- =============================================================================
-- estat = 'anulada', amb qui, quan i motiu opcional.
-- El lot torna a envasat i es pot tornar a expedir.
-- L'índex únic només cobreix expedicions actives (en trànsit o entregada),
-- així una d'anul·lada no impedeix la següent ni es perd.
-- =============================================================================

ALTER TABLE public.obrador_expedicions
  ADD COLUMN IF NOT EXISTS anulada_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS anulada_per UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS anulada_motiu TEXT;

COMMENT ON COLUMN public.obrador_expedicions.anulada_at IS
  'Moment en què management anul·la l''expedició. La fila es conserva.';
COMMENT ON COLUMN public.obrador_expedicions.anulada_per IS
  'Usuari autenticat que anul·la l''expedició.';
COMMENT ON COLUMN public.obrador_expedicions.anulada_motiu IS
  'Motiu opcional de l''anul·lació.';

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'obrador_expedicions'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%estat%'
  LOOP
    EXECUTE format('ALTER TABLE public.obrador_expedicions DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.obrador_expedicions
  DROP CONSTRAINT IF EXISTS obrador_expedicions_estat_check;

ALTER TABLE public.obrador_expedicions
  ADD CONSTRAINT obrador_expedicions_estat_check
  CHECK (estat IS NULL OR estat IN ('en trànsit', 'entregat', 'anulada'));

DROP INDEX IF EXISTS public.idx_obrador_expedicions_id_lot_unique;

CREATE UNIQUE INDEX IF NOT EXISTS idx_obrador_expedicions_id_lot_activa
  ON public.obrador_expedicions (id_lot)
  WHERE estat IS DISTINCT FROM 'anulada';

-- Ningú, ni management, pot esborrar una expedició des de l'API.
DROP POLICY IF EXISTS obrador_expedicions_delete_management ON public.obrador_expedicions;

-- La versió anterior era (uuid) i feia DELETE. Cal treure-la perquè
-- CREATE OR REPLACE amb un argument de més deixaria les dues.
DROP FUNCTION IF EXISTS public.obrador_anular_expedicio(uuid);

CREATE OR REPLACE FUNCTION public.obrador_anular_expedicio(
  p_id uuid,
  p_motiu text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exp public.obrador_expedicions%ROWTYPE;
  v_lot public.obrador_lots%ROWTYPE;
  v_motiu text := NULLIF(btrim(COALESCE(p_motiu, '')), '');
BEGIN
  IF NOT public.obrador_is_management_user() THEN
    RAISE EXCEPTION 'Només management pot anul·lar expedicions.';
  END IF;

  IF v_motiu IS NOT NULL AND char_length(v_motiu) > 500 THEN
    RAISE EXCEPTION 'El motiu és massa llarg.';
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

  IF COALESCE(v_exp.estat, '') = 'anulada' THEN
    RAISE EXCEPTION 'Aquesta expedició ja està anul·lada.';
  END IF;

  SELECT *
  INTO v_lot
  FROM public.obrador_lots
  WHERE id = v_exp.id_lot
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lot no trobat';
  END IF;

  UPDATE public.obrador_expedicions
  SET estat = 'anulada',
      anulada_at = now(),
      anulada_per = auth.uid(),
      anulada_motiu = v_motiu,
      updated_at = now()
  WHERE id = p_id
  RETURNING * INTO v_exp;

  UPDATE public.obrador_lots
  SET estat = 'envasat',
      updated_at = now()
  WHERE id = v_lot.id
  RETURNING * INTO v_lot;

  RETURN jsonb_build_object(
    'anulada', true,
    'id_expedicio', p_id,
    'expedicio', to_jsonb(v_exp),
    'lot', to_jsonb(v_lot)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.obrador_anular_expedicio(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.obrador_anular_expedicio(uuid, text) TO authenticated;

COMMENT ON FUNCTION public.obrador_anular_expedicio(uuid, text) IS
  'Marca l''expedició en trànsit com a anulada sense esborrar-la i torna el lot a envasat.';

-- Una expedició anul·lada no ocupa el lloc: el lot es pot tornar a expedir.
CREATE OR REPLACE FUNCTION public.obrador_crear_expedicio_i_marcar_lot(
  p_id_lot uuid,
  p_id_client text,
  p_comanda_holded text DEFAULT NULL,
  p_check_sortida boolean DEFAULT false,
  p_check_client boolean DEFAULT false,
  p_observacions text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lot obrador_lots%ROWTYPE;
  v_lot_final obrador_lots%ROWTYPE;
  v_expedicio obrador_expedicions%ROWTYPE;
BEGIN
  IF NOT COALESCE(p_check_sortida, false) THEN
    RAISE EXCEPTION 'Cal verificar el producte abans de sortir (check_sortida).';
  END IF;

  IF NULLIF(btrim(COALESCE(p_id_client, '')), '') IS NULL THEN
    RAISE EXCEPTION 'El client és obligatori.';
  END IF;

  SELECT *
  INTO v_lot
  FROM obrador_lots
  WHERE id = p_id_lot
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lot no trobat';
  END IF;

  IF COALESCE(lower(v_lot.estat), '') <> 'envasat' THEN
    IF COALESCE(lower(v_lot.estat), '') = 'expedit' THEN
      RAISE EXCEPTION 'Aquest lot ja ha estat expedit.';
    END IF;
    RAISE EXCEPTION 'Aquest lot està en estat "%" i no es pot expedir fins que estigui envasat.', COALESCE(v_lot.estat, 'desconegut');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM obrador_expedicions
    WHERE id_lot = p_id_lot
      AND COALESCE(estat, '') <> 'anulada'
  ) THEN
    RAISE EXCEPTION 'Aquest lot ja té una expedició registrada.';
  END IF;

  INSERT INTO obrador_expedicions (
    id_lot,
    id_client,
    comanda_holded,
    check_sortida,
    check_client,
    observacions
  )
  VALUES (
    p_id_lot,
    NULLIF(btrim(COALESCE(p_id_client, '')), ''),
    NULLIF(btrim(COALESCE(p_comanda_holded, '')), ''),
    true,
    COALESCE(p_check_client, false),
    NULLIF(btrim(COALESCE(p_observacions, '')), '')
  )
  RETURNING * INTO v_expedicio;

  UPDATE obrador_lots
  SET estat = 'expedit',
      updated_at = now()
  WHERE id = p_id_lot
  RETURNING * INTO v_lot_final;

  RETURN jsonb_build_object(
    'expedicio', to_jsonb(v_expedicio),
    'lot', to_jsonb(v_lot_final)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.obrador_crear_expedicio_i_marcar_lot(uuid, text, text, boolean, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.obrador_crear_expedicio_i_marcar_lot(uuid, text, text, boolean, boolean, text) TO authenticated;

-- El transport no pot donar per entregada una expedició anul·lada.
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

  SELECT *
  INTO v_expedicio
  FROM obrador_expedicions
  WHERE id = p_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Expedició no trobada';
  END IF;

  IF COALESCE(v_expedicio.estat, '') = 'anulada' THEN
    RAISE EXCEPTION 'No es pot marcar com a entregada una expedició anul·lada.';
  END IF;

  UPDATE obrador_expedicions
  SET estat = 'entregat',
      check_client = coalesce(p_check_client, false),
      updated_at = now()
  WHERE id = p_id
  RETURNING * INTO v_expedicio;

  RETURN to_jsonb(v_expedicio);
END;
$$;

REVOKE ALL ON FUNCTION public.obrador_marcar_expedicio_entregada(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.obrador_marcar_expedicio_entregada(uuid, boolean) TO authenticated;

-- El QR públic ignora les expedicions anul·lades.
CREATE OR REPLACE FUNCTION public.obrador_ok_client_public(p_codi text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  codi_norm text;
  v_lot uuid;
  v_exp obrador_expedicions%ROWTYPE;
BEGIN
  codi_norm := btrim(coalesce(p_codi, ''));
  IF codi_norm = '' THEN
    RETURN NULL;
  END IF;

  SELECT l.id
  INTO v_lot
  FROM obrador_lots l
  LEFT JOIN obrador_etiquetes e ON e.id_lot = l.id
  WHERE e.codi_qr = codi_norm
     OR l.codi_lot = codi_norm
  ORDER BY e.data_envasat DESC NULLS LAST
  LIMIT 1;

  IF v_lot IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT *
  INTO v_exp
  FROM obrador_expedicions
  WHERE id_lot = v_lot
    AND COALESCE(estat, '') <> 'anulada'
  ORDER BY data_sortida DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('te_expedicio', false);
  END IF;

  RETURN jsonb_build_object(
    'te_expedicio', true,
    'estat', v_exp.estat,
    'id_client', v_exp.id_client,
    'check_client', coalesce(v_exp.check_client, false),
    'confirmat_nom', v_exp.confirmat_client_nom,
    'confirmat_at', v_exp.confirmat_client_at,
    'confirmat_nota', v_exp.confirmat_client_nota
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.obrador_confirmar_ok_client(
  p_codi text,
  p_nom text,
  p_nota text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  codi_norm text;
  v_nom text;
  v_nota text;
  v_lot uuid;
  v_exp obrador_expedicions%ROWTYPE;
BEGIN
  codi_norm := btrim(coalesce(p_codi, ''));
  v_nom := btrim(coalesce(p_nom, ''));
  v_nota := nullif(btrim(coalesce(p_nota, '')), '');

  IF codi_norm = '' THEN
    RAISE EXCEPTION 'Codi de traçabilitat no vàlid.';
  END IF;
  IF char_length(v_nom) < 3 THEN
    RAISE EXCEPTION 'Escriu el nom de qui rep el producte (mínim 3 caràcters).';
  END IF;
  IF v_nota IS NOT NULL AND char_length(v_nota) > 500 THEN
    RAISE EXCEPTION 'L''observació és massa llarga.';
  END IF;

  SELECT l.id
  INTO v_lot
  FROM obrador_lots l
  LEFT JOIN obrador_etiquetes e ON e.id_lot = l.id
  WHERE e.codi_qr = codi_norm
     OR l.codi_lot = codi_norm
  ORDER BY e.data_envasat DESC NULLS LAST
  LIMIT 1;

  IF v_lot IS NULL THEN
    RAISE EXCEPTION 'Lot no trobat.';
  END IF;

  SELECT *
  INTO v_exp
  FROM obrador_expedicions
  WHERE id_lot = v_lot
    AND COALESCE(estat, '') <> 'anulada'
  ORDER BY data_sortida DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Aquest lot encara no ha sortit de l''obrador.';
  END IF;

  IF v_exp.confirmat_client_at IS NOT NULL THEN
    RAISE EXCEPTION 'Aquest lot ja té l''OK del servei receptor.';
  END IF;

  UPDATE obrador_expedicions
  SET check_client = true,
      confirmat_client_nom = v_nom,
      confirmat_client_at = now(),
      confirmat_client_nota = v_nota,
      updated_at = now()
  WHERE id = v_exp.id
    AND confirmat_client_at IS NULL
  RETURNING * INTO v_exp;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Aquest lot ja té l''OK del servei receptor.';
  END IF;

  RETURN jsonb_build_object(
    'te_expedicio', true,
    'estat', v_exp.estat,
    'id_client', v_exp.id_client,
    'check_client', true,
    'confirmat_nom', v_exp.confirmat_client_nom,
    'confirmat_at', v_exp.confirmat_client_at,
    'confirmat_nota', v_exp.confirmat_client_nota
  );
END;
$$;

REVOKE ALL ON FUNCTION public.obrador_ok_client_public(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.obrador_confirmar_ok_client(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.obrador_ok_client_public(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.obrador_confirmar_ok_client(text, text, text) TO anon, authenticated;
