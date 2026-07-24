-- =============================================================================
-- Obrador — Producte ↔ proveïdors + lot amb N recepcions (traçabilitat)
-- Executar a Supabase SQL Editor després del schema Ac3 + atomic_flows.
-- Idempotent.
-- =============================================================================

-- 1) Producte → proveïdors (matèria primera esperada)
CREATE TABLE IF NOT EXISTS public.obrador_producte_proveidors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  id_producte UUID NOT NULL REFERENCES public.obrador_productes(id) ON DELETE CASCADE,
  id_proveidor UUID NOT NULL REFERENCES public.obrador_proveidors(id) ON DELETE RESTRICT,
  ingredient_nom TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT obrador_producte_proveidors_unique
    UNIQUE (id_producte, id_proveidor, ingredient_nom)
);

CREATE INDEX IF NOT EXISTS idx_obrador_producte_proveidors_producte
  ON public.obrador_producte_proveidors(id_producte);
CREATE INDEX IF NOT EXISTS idx_obrador_producte_proveidors_proveidor
  ON public.obrador_producte_proveidors(id_proveidor);

COMMENT ON TABLE public.obrador_producte_proveidors IS
  'Proveïdors de matèria primera associats a un producte elaborat (ex. pa + pernil → bocata).';
COMMENT ON COLUMN public.obrador_producte_proveidors.ingredient_nom IS
  'Etiqueta opcional de l''ingredient (pa, pernil…). Sense quantitats/costos (escandall futur).';

-- 2) Lot → N recepcions
CREATE TABLE IF NOT EXISTS public.obrador_lot_recepcions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  id_lot UUID NOT NULL REFERENCES public.obrador_lots(id) ON DELETE CASCADE,
  id_recepcio UUID NOT NULL REFERENCES public.obrador_recepcions(id) ON DELETE RESTRICT,
  ordre INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT obrador_lot_recepcions_unique UNIQUE (id_lot, id_recepcio)
);

CREATE INDEX IF NOT EXISTS idx_obrador_lot_recepcions_lot
  ON public.obrador_lot_recepcions(id_lot);
CREATE INDEX IF NOT EXISTS idx_obrador_lot_recepcions_recepcio
  ON public.obrador_lot_recepcions(id_recepcio);

COMMENT ON TABLE public.obrador_lot_recepcions IS
  'Recepcions de matèria primera consumides en un lot de producció.';

-- Backfill des de id_recepcio principal (lots ja existents)
INSERT INTO public.obrador_lot_recepcions (id_lot, id_recepcio, ordre)
SELECT l.id, l.id_recepcio, 1
FROM public.obrador_lots l
WHERE l.id_recepcio IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.obrador_lot_recepcions lr
    WHERE lr.id_lot = l.id AND lr.id_recepcio = l.id_recepcio
  );

-- 3) RLS
ALTER TABLE public.obrador_producte_proveidors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.obrador_lot_recepcions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS obrador_producte_proveidors_select_staff ON public.obrador_producte_proveidors;
CREATE POLICY obrador_producte_proveidors_select_staff ON public.obrador_producte_proveidors
  FOR SELECT TO authenticated
  USING (public.obrador_is_portal_staff_user());

DROP POLICY IF EXISTS obrador_producte_proveidors_write_management ON public.obrador_producte_proveidors;
CREATE POLICY obrador_producte_proveidors_write_management ON public.obrador_producte_proveidors
  FOR ALL TO authenticated
  USING (public.obrador_is_management_user())
  WITH CHECK (public.obrador_is_management_user());

DROP POLICY IF EXISTS obrador_lot_recepcions_select_staff ON public.obrador_lot_recepcions;
CREATE POLICY obrador_lot_recepcions_select_staff ON public.obrador_lot_recepcions
  FOR SELECT TO authenticated
  USING (public.obrador_is_portal_staff_user());

DROP POLICY IF EXISTS obrador_lot_recepcions_write_management ON public.obrador_lot_recepcions;
CREATE POLICY obrador_lot_recepcions_write_management ON public.obrador_lot_recepcions
  FOR ALL TO authenticated
  USING (public.obrador_is_management_user())
  WITH CHECK (public.obrador_is_management_user());

-- 4) RPC crear lot amb N recepcions
-- Signature antiga: (uuid,uuid,uuid,numeric,numeric,boolean,text,integer,text[])
DROP FUNCTION IF EXISTS public.obrador_crear_lot_i_etiqueta(uuid, uuid, uuid, numeric, numeric, boolean, text, integer, text[]);

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
  v_lot obrador_lots%ROWTYPE;
  v_lot_final obrador_lots%ROWTYPE;
  v_etiqueta obrador_etiquetes%ROWTYPE;
  v_data_caducitat date;
  v_codi_qr text;
  v_ordre integer := 0;
  v_proveidors_producte uuid[];
  v_prov_count integer;
BEGIN
  IF p_id_producte IS NULL THEN
    RAISE EXCEPTION 'Producte obligatori';
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

  -- Validar totes les recepcions
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

  -- Si el producte té proveïdors associats, les recepcions han de ser d''aquests
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
        RAISE EXCEPTION
          'La recepció no correspon a un proveïdor associat a aquest producte.';
      END IF;
    END LOOP;
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
    v_principal,
    p_id_operari,
    p_quantitat_kg,
    p_temp_final_coccio,
    COALESCE(p_mostra_guardada, true),
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

REVOKE ALL ON FUNCTION public.obrador_crear_lot_i_etiqueta(uuid, uuid, uuid, numeric, numeric, boolean, text, integer, text[], uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.obrador_crear_lot_i_etiqueta(uuid, uuid, uuid, numeric, numeric, boolean, text, integer, text[], uuid[]) TO authenticated;

-- 5) Traça pública: llista de recepcions
CREATE OR REPLACE FUNCTION public.get_obrador_lot_public(p_codi text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  codi_norm text;
  v_lot_id uuid;
  v_recepcions jsonb;
BEGIN
  codi_norm := trim(p_codi);
  IF codi_norm = '' THEN
    RETURN NULL;
  END IF;

  SELECT l.id
  INTO v_lot_id
  FROM obrador_etiquetes e
  INNER JOIN obrador_lots l ON l.id = e.id_lot
  WHERE e.codi_qr = codi_norm
     OR l.codi_lot = codi_norm
  ORDER BY e.data_envasat DESC NULLS LAST
  LIMIT 1;

  IF v_lot_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'proveidor', prov.nom,
      'lot_proveidor', r.lot_proveidor,
      'data_recepcio', r.data_recepcio
    )
    ORDER BY lr.ordre ASC NULLS LAST, r.data_recepcio DESC NULLS LAST
  ), '[]'::jsonb)
  INTO v_recepcions
  FROM obrador_lot_recepcions lr
  INNER JOIN obrador_recepcions r ON r.id = lr.id_recepcio
  LEFT JOIN obrador_proveidors prov ON prov.id = r.id_proveidor
  WHERE lr.id_lot = v_lot_id;

  -- Fallback si encara no hi ha files a lot_recepcions
  IF v_recepcions = '[]'::jsonb THEN
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'proveidor', prov.nom,
        'lot_proveidor', r.lot_proveidor,
        'data_recepcio', r.data_recepcio
      )
    ), '[]'::jsonb)
    INTO v_recepcions
    FROM obrador_lots l
    LEFT JOIN obrador_recepcions r ON r.id = l.id_recepcio
    LEFT JOIN obrador_proveidors prov ON prov.id = r.id_proveidor
    WHERE l.id = v_lot_id
      AND r.id IS NOT NULL;
  END IF;

  SELECT jsonb_build_object(
    'codi_lot', l.codi_lot,
    'codi_qr', e.codi_qr,
    'producte', p.nom,
    'data_produccio', l.data_produccio,
    'data_caducitat', e.data_caducitat,
    'allergens', COALESCE(e.allergens, p.allergens, ARRAY[]::text[]),
    'estat', l.estat,
    'quantitat_kg', l.quantitat_kg,
    'proveidor', (v_recepcions -> 0 ->> 'proveidor'),
    'lot_proveidor', (v_recepcions -> 0 ->> 'lot_proveidor'),
    'data_recepcio', (v_recepcions -> 0 ->> 'data_recepcio'),
    'recepcions', v_recepcions
  )
  INTO result
  FROM obrador_etiquetes e
  INNER JOIN obrador_lots l ON l.id = e.id_lot
  INNER JOIN obrador_productes p ON p.id = l.id_producte
  WHERE l.id = v_lot_id
  ORDER BY e.data_envasat DESC NULLS LAST
  LIMIT 1;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_obrador_lot_public(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_obrador_lot_public(text) TO anon, authenticated;

COMMENT ON FUNCTION public.get_obrador_lot_public(text) IS
  'Dades públiques d''un lot per escaneig QR. Inclou recepcions[] (N proveïdors); sense operari ni observacions.';
