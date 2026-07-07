-- =============================================================================
-- Obrador — RPCs atòmiques per lots i expedicions
-- =============================================================================
-- Ús: executar aquest fitxer a Supabase SQL Editor després del schema base.
-- És idempotent i es pot reexecutar.
-- =============================================================================

ALTER TABLE obrador_expedicions
  ADD COLUMN IF NOT EXISTS check_sortida BOOLEAN DEFAULT false;

CREATE OR REPLACE FUNCTION public.obrador_crear_lot_i_etiqueta(
  p_id_producte uuid,
  p_id_recepcio uuid,
  p_id_operari uuid DEFAULT NULL,
  p_quantitat_kg numeric DEFAULT NULL,
  p_temp_final_coccio numeric DEFAULT NULL,
  p_mostra_guardada boolean DEFAULT true,
  p_observacions text DEFAULT NULL,
  p_caducitat_dies integer DEFAULT 3,
  p_allergens text[] DEFAULT ARRAY[]::text[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recepcio obrador_recepcions%ROWTYPE;
  v_lot obrador_lots%ROWTYPE;
  v_lot_final obrador_lots%ROWTYPE;
  v_etiqueta obrador_etiquetes%ROWTYPE;
  v_data_caducitat date;
  v_codi_qr text;
BEGIN
  SELECT *
  INTO v_recepcio
  FROM obrador_recepcions
  WHERE id = p_id_recepcio;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Recepció no trobada';
  END IF;

  IF COALESCE(lower(v_recepcio.estat), '') NOT IN ('bo', 'regular') THEN
    RAISE EXCEPTION 'La recepció seleccionada està en estat "%" i no es pot utilitzar per producció.', COALESCE(v_recepcio.estat, 'desconegut');
  END IF;

  INSERT INTO obrador_lots (
    id_producte,
    id_recepcio,
    id_operari,
    quantitat_kg,
    temp_final_coccio,
    mostra_guardada,
    observacions,
    estat
  )
  VALUES (
    p_id_producte,
    p_id_recepcio,
    p_id_operari,
    p_quantitat_kg,
    p_temp_final_coccio,
    COALESCE(p_mostra_guardada, true),
    NULLIF(btrim(COALESCE(p_observacions, '')), ''),
    'produit'
  )
  RETURNING * INTO v_lot;

  v_data_caducitat := (
    (now() AT TIME ZONE 'Europe/Madrid')::date
    + COALESCE(NULLIF(p_caducitat_dies, 0), 3)
  );
  v_codi_qr := 'QR-' || v_lot.id::text || '-' || floor(extract(epoch from clock_timestamp()) * 1000)::bigint::text;

  INSERT INTO obrador_etiquetes (
    id_lot,
    codi_qr,
    allergens,
    data_caducitat
  )
  VALUES (
    v_lot.id,
    v_codi_qr,
    COALESCE(p_allergens, ARRAY[]::text[]),
    v_data_caducitat
  )
  RETURNING * INTO v_etiqueta;

  UPDATE obrador_lots
  SET estat = 'envasat',
      updated_at = now()
  WHERE id = v_lot.id
  RETURNING * INTO v_lot_final;

  RETURN jsonb_build_object(
    'lot', to_jsonb(v_lot_final),
    'etiqueta', to_jsonb(v_etiqueta)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.obrador_crear_lot_i_etiqueta(uuid, uuid, uuid, numeric, numeric, boolean, text, integer, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.obrador_crear_lot_i_etiqueta(uuid, uuid, uuid, numeric, numeric, boolean, text, integer, text[]) TO authenticated;

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
  SELECT *
  INTO v_lot
  FROM obrador_lots
  WHERE id = p_id_lot;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lot no trobat';
  END IF;

  IF COALESCE(lower(v_lot.estat), '') <> 'envasat' THEN
    IF COALESCE(lower(v_lot.estat), '') = 'expedit' THEN
      RAISE EXCEPTION 'Aquest lot ja ha estat expedit.';
    END IF;
    RAISE EXCEPTION 'Aquest lot està en estat "%" i no es pot expedir fins que estigui envasat.', COALESCE(v_lot.estat, 'desconegut');
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
    COALESCE(p_check_sortida, false),
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
