-- =============================================================================
-- Controls que el guió d'Ac3 presenta com a impossibles de saltar
-- Executar a SQL Editor (idempotent)
-- La pantalla ja els avisa. Aquí els imposa la base de dades.
-- =============================================================================

-- Recepció rebutjada sense explicació: no es desa.
CREATE OR REPLACE FUNCTION public.obrador_recepcions_exigir_rebuig()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF coalesce(lower(NEW.estat), '') = 'rebutjat'
     AND nullif(btrim(coalesce(NEW.observacions, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Una recepció rebutjada ha de tenir una explicació.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_obrador_recepcions_exigir_rebuig ON public.obrador_recepcions;
CREATE TRIGGER trg_obrador_recepcions_exigir_rebuig
  BEFORE INSERT OR UPDATE ON public.obrador_recepcions
  FOR EACH ROW
  EXECUTE FUNCTION public.obrador_recepcions_exigir_rebuig();

-- Incidència d'una paraula: no es desa.
CREATE OR REPLACE FUNCTION public.obrador_incidencies_exigir_descripcio()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.descripcio IS DISTINCT FROM OLD.descripcio THEN
    IF char_length(btrim(coalesce(NEW.descripcio, ''))) < 10 THEN
      RAISE EXCEPTION 'La descripció ha de tenir almenys 10 caràcters.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_obrador_incidencies_exigir_descripcio ON public.obrador_incidencies;
CREATE TRIGGER trg_obrador_incidencies_exigir_descripcio
  BEFORE INSERT OR UPDATE ON public.obrador_incidencies
  FOR EACH ROW
  EXECUTE FUNCTION public.obrador_incidencies_exigir_descripcio();

-- Qui ha fet l'expedició.
ALTER TABLE public.obrador_expedicions
  ADD COLUMN IF NOT EXISTS expedida_per UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.obrador_expedicions.expedida_per IS
  'Usuari autenticat que registra l''expedició.';

-- Lot: mostra obligatòria, cocció contra la fitxa, caducitat i al·lèrgens de la fitxa.
CREATE OR REPLACE FUNCTION public.obrador_crear_lot_i_etiqueta(
  p_id_producte uuid,
  p_id_recepcio uuid DEFAULT NULL,
  p_id_operari uuid DEFAULT NULL,
  p_quantitat_kg numeric DEFAULT NULL,
  p_temp_final_coccio numeric DEFAULT NULL,
  p_mostra_guardada boolean DEFAULT true,
  p_observacions text DEFAULT NULL,
  p_caducitat_dies integer DEFAULT 3,
  p_allergens text[] DEFAULT ARRAY[]::text[],
  p_id_recepcions uuid[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ids uuid[];
  v_id uuid;
  v_principal uuid;
  v_recepcio obrador_recepcions%ROWTYPE;
  v_producte obrador_productes%ROWTYPE;
  v_lot obrador_lots%ROWTYPE;
  v_lot_final obrador_lots%ROWTYPE;
  v_etiqueta obrador_etiquetes%ROWTYPE;
  v_data_caducitat date;
  v_codi_qr text;
  v_ordre integer := 0;
  v_proveidors_producte uuid[];
  v_prov_count integer;
BEGIN
  IF NOT COALESCE(public.obrador_is_management_user(), false) THEN
    RAISE EXCEPTION 'Sense permís per crear lots.';
  END IF;

  IF p_id_producte IS NULL THEN
    RAISE EXCEPTION 'Producte obligatori';
  END IF;

  SELECT * INTO v_producte FROM obrador_productes WHERE id = p_id_producte;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Producte no trobat';
  END IF;

  IF NOT coalesce(p_mostra_guardada, false) THEN
    RAISE EXCEPTION 'Cal confirmar que s''ha guardat la mostra. El lot no es desa.';
  END IF;

  IF v_producte.temp_coccio IS NOT NULL
     AND (p_temp_final_coccio IS NULL OR p_temp_final_coccio < v_producte.temp_coccio) THEN
    RAISE EXCEPTION 'Temperatura de cocció insuficient. El mínim de la fitxa és % °C i el lot no es desa.', v_producte.temp_coccio;
  END IF;

  IF v_producte.caducitat_dies IS NULL OR v_producte.caducitat_dies <= 0 THEN
    RAISE EXCEPTION 'La fitxa del producte no té els dies de caducitat. L''etiqueta no es pot calcular.';
  END IF;

  IF p_id_recepcions IS NOT NULL AND COALESCE(array_length(p_id_recepcions, 1), 0) > 0 THEN
    SELECT ARRAY(
      SELECT DISTINCT x
      FROM unnest(p_id_recepcions) AS x
      WHERE x IS NOT NULL
    ) INTO v_ids;
  ELSIF p_id_recepcio IS NOT NULL THEN
    v_ids := ARRAY[p_id_recepcio];
  ELSE
    RAISE EXCEPTION 'Cal almenys una recepció';
  END IF;

  IF COALESCE(array_length(v_ids, 1), 0) < 1 THEN
    RAISE EXCEPTION 'Cal almenys una recepció';
  END IF;

  v_principal := v_ids[1];

  FOREACH v_id IN ARRAY v_ids
  LOOP
    SELECT * INTO v_recepcio FROM obrador_recepcions WHERE id = v_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Recepció no trobada: %', v_id;
    END IF;
    IF COALESCE(lower(v_recepcio.estat), '') NOT IN ('bo', 'regular') THEN
      RAISE EXCEPTION 'La recepció % està en estat "%" i no es pot utilitzar per producció.',
        v_id, COALESCE(v_recepcio.estat, 'desconegut');
    END IF;
  END LOOP;

  SELECT COALESCE(array_agg(pp.id_proveidor), ARRAY[]::uuid[])
  INTO v_proveidors_producte
  FROM obrador_producte_proveidors pp
  WHERE pp.id_producte = p_id_producte;

  v_prov_count := COALESCE(array_length(v_proveidors_producte, 1), 0);
  IF v_prov_count > 0 THEN
    FOREACH v_id IN ARRAY v_ids
    LOOP
      SELECT * INTO v_recepcio FROM obrador_recepcions WHERE id = v_id;
      IF NOT (v_recepcio.id_proveidor = ANY (v_proveidors_producte)) THEN
        RAISE EXCEPTION 'La recepció no correspon a un proveïdor associat a aquest producte.';
      END IF;
    END LOOP;
  END IF;

  INSERT INTO obrador_lots (
    id_producte, id_recepcio, id_operari, quantitat_kg,
    temp_final_coccio, mostra_guardada, observacions, estat
  )
  VALUES (
    p_id_producte, v_principal, p_id_operari, p_quantitat_kg,
    p_temp_final_coccio, true,
    NULLIF(btrim(COALESCE(p_observacions, '')), ''),
    'produit'
  )
  RETURNING * INTO v_lot;

  FOREACH v_id IN ARRAY v_ids
  LOOP
    v_ordre := v_ordre + 1;
    INSERT INTO obrador_lot_recepcions (id_lot, id_recepcio, ordre)
    VALUES (v_lot.id, v_id, v_ordre)
    ON CONFLICT (id_lot, id_recepcio) DO NOTHING;
  END LOOP;

  v_data_caducitat := (
    (now() AT TIME ZONE 'Europe/Madrid')::date + v_producte.caducitat_dies
  );
  v_codi_qr := 'QR-' || v_lot.id::text || '-' || floor(extract(epoch from clock_timestamp()) * 1000)::bigint::text;

  INSERT INTO obrador_etiquetes (id_lot, codi_qr, allergens, data_caducitat)
  VALUES (
    v_lot.id,
    v_codi_qr,
    COALESCE(v_producte.allergens, ARRAY[]::text[]),
    v_data_caducitat
  )
  RETURNING * INTO v_etiqueta;

  UPDATE obrador_lots
  SET estat = 'envasat', updated_at = now()
  WHERE id = v_lot.id
  RETURNING * INTO v_lot_final;

  RETURN jsonb_build_object(
    'lot', to_jsonb(v_lot_final),
    'etiqueta', to_jsonb(v_etiqueta)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.obrador_crear_lot_i_etiqueta(uuid, uuid, uuid, numeric, numeric, boolean, text, integer, text[], uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.obrador_crear_lot_i_etiqueta(uuid, uuid, uuid, numeric, numeric, boolean, text, integer, text[], uuid[]) TO authenticated;

-- Expedició: sense etiqueta no surt, i queda qui l'ha feta.
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
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Cal una sessió per registrar qui fa l''expedició.';
  END IF;

  IF NOT (
    COALESCE(public.obrador_is_management_user(), false)
    OR COALESCE(public.obrador_is_portal_staff_user(), false)
  ) THEN
    RAISE EXCEPTION 'Sense permís per expedir lots.';
  END IF;

  IF NOT COALESCE(p_check_sortida, false) THEN
    RAISE EXCEPTION 'Cal verificar el producte abans de sortir (check_sortida).';
  END IF;

  IF NULLIF(btrim(COALESCE(p_id_client, '')), '') IS NULL THEN
    RAISE EXCEPTION 'El client és obligatori.';
  END IF;

  SELECT * INTO v_lot FROM obrador_lots WHERE id = p_id_lot FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lot no trobat';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM obrador_etiquetes WHERE id_lot = p_id_lot) THEN
    RAISE EXCEPTION 'Aquest lot no té etiqueta generada i no es pot expedir.';
  END IF;

  IF COALESCE(lower(v_lot.estat), '') <> 'envasat' THEN
    IF COALESCE(lower(v_lot.estat), '') = 'expedit' THEN
      RAISE EXCEPTION 'Aquest lot ja ha estat expedit.';
    END IF;
    RAISE EXCEPTION 'Aquest lot està en estat "%" i no es pot expedir fins que estigui envasat.', COALESCE(v_lot.estat, 'desconegut');
  END IF;

  IF EXISTS (
    SELECT 1 FROM obrador_expedicions
    WHERE id_lot = p_id_lot AND COALESCE(estat, '') <> 'anulada'
  ) THEN
    RAISE EXCEPTION 'Aquest lot ja té una expedició registrada.';
  END IF;

  INSERT INTO obrador_expedicions (
    id_lot, id_client, comanda_holded, check_sortida, check_client, observacions, expedida_per
  )
  VALUES (
    p_id_lot,
    NULLIF(btrim(COALESCE(p_id_client, '')), ''),
    NULLIF(btrim(COALESCE(p_comanda_holded, '')), ''),
    true,
    COALESCE(p_check_client, false),
    NULLIF(btrim(COALESCE(p_observacions, '')), ''),
    auth.uid()
  )
  RETURNING * INTO v_expedicio;

  UPDATE obrador_lots
  SET estat = 'expedit', updated_at = now()
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
