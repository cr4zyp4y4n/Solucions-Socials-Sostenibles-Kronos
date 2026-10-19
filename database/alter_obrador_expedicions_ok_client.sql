-- =============================================================================
-- OK del servei receptor, escanejant el QR del producte (sense compte)
-- El transportista marca estat = entregat. El centre marca check_client.
-- Executar a SQL Editor (idempotent)
-- =============================================================================

ALTER TABLE public.obrador_expedicions
  ADD COLUMN IF NOT EXISTS confirmat_client_nom TEXT,
  ADD COLUMN IF NOT EXISTS confirmat_client_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS confirmat_client_nota TEXT;

COMMENT ON COLUMN public.obrador_expedicions.confirmat_client_nom IS
  'Nom de la persona del servei receptor que confirma l''OK escanejant el QR. No és el transportista.';
COMMENT ON COLUMN public.obrador_expedicions.confirmat_client_at IS
  'Moment de l''OK del servei receptor.';
COMMENT ON COLUMN public.obrador_expedicions.confirmat_client_nota IS
  'Observació lliure del servei receptor en confirmar la recepció.';

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

COMMENT ON FUNCTION public.obrador_confirmar_ok_client(text, text, text) IS
  'OK del servei receptor via QR, sense compte. No canvia estat: l''entrega la marca el transport.';
