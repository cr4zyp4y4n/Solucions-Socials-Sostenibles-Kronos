-- =============================================================================
-- Obrador: una sola expedició per lot + lock anti-carrera
-- Evita dues expedicions concurrentes sobre el mateix lot.
-- =============================================================================

-- Conserva la primera expedició de cada lot (més antiga) i elimina duplicats
DELETE FROM public.obrador_expedicions
WHERE id IN (
  SELECT id
  FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY id_lot
        ORDER BY created_at ASC NULLS LAST, id ASC
      ) AS rn
    FROM public.obrador_expedicions
  ) t
  WHERE rn > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_obrador_expedicions_id_lot_unique
  ON public.obrador_expedicions (id_lot);

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
  IF NOT (
    public.obrador_is_management_user()
    OR public.obrador_is_portal_staff_user()
  ) THEN
    RAISE EXCEPTION 'No autoritzat per expedir lots.';
  END IF;

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

  IF EXISTS (SELECT 1 FROM obrador_expedicions WHERE id_lot = p_id_lot) THEN
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
