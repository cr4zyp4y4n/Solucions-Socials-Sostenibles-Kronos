-- =============================================================================
-- Neteja de l'obrador antic: setmanal, forn dues vegades, mensual i trimestral
-- No toca els registres ja signats. Executar després de alter_obrador_registres_higiene.sql
-- No tornis a executar el fitxer d'higiene sencer: avortaria en els registres nous.
-- =============================================================================

ALTER TABLE public.obrador_tipus_registre
  ADD COLUMN IF NOT EXISTS maxim_per_periode INTEGER;

COMMENT ON COLUMN public.obrador_tipus_registre.maxim_per_periode IS
  'Màxim de registres dins del període. El forn és 2 per setmana. Buit si en basta un, o si no hi ha límit.';

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
      AND rel.relname = 'obrador_tipus_registre'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%frequencia%'
  LOOP
    EXECUTE format('ALTER TABLE public.obrador_tipus_registre DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.obrador_tipus_registre
  ADD CONSTRAINT obrador_tipus_registre_frequencia_check
  CHECK (frequencia IN ('diari', 'setmanal', 'mensual', 'trimestral', 'esdeveniment'));

CREATE OR REPLACE FUNCTION public.obrador_registres_torn_abans_desar()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_item jsonb;
  v_tipus public.obrador_tipus_registre%ROWTYPE;
  v_n integer;
  v_fets integer;
BEGIN
  IF NEW.tipus_codi IS NULL THEN
    NEW.tipus_codi := CASE NEW.moment
      WHEN 'inici' THEN 'torn_inici'
      WHEN 'produccio' THEN 'torn_produccio'
      WHEN 'tancament' THEN 'torn_tancament'
      ELSE NULL
    END;
  END IF;

  IF NEW.tipus_codi IS NULL THEN
    RAISE EXCEPTION 'Cal un tipus de registre.';
  END IF;

  SELECT * INTO v_tipus
  FROM public.obrador_tipus_registre
  WHERE codi = NEW.tipus_codi;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tipus de registre desconegut: %', NEW.tipus_codi;
  END IF;

  IF NOT coalesce(v_tipus.actiu, false) THEN
    RAISE EXCEPTION 'Aquest tipus de registre està desactivat.';
  END IF;

  NEW.moment := CASE NEW.tipus_codi
    WHEN 'torn_inici' THEN 'inici'
    WHEN 'torn_produccio' THEN 'produccio'
    WHEN 'torn_tancament' THEN 'tancament'
    ELSE NULL
  END;

  IF NEW.data IS NULL THEN
    NEW.data := CURRENT_DATE;
  END IF;

  NEW.periode_inici := CASE v_tipus.frequencia
    WHEN 'mensual' THEN date_trunc('month', NEW.data)::date
    WHEN 'trimestral' THEN date_trunc('quarter', NEW.data)::date
    WHEN 'setmanal' THEN date_trunc('week', NEW.data)::date
    ELSE NEW.data
  END;

  IF NEW.items IS NULL OR jsonb_typeof(NEW.items) <> 'array' THEN
    NEW.items := '[]'::jsonb;
  END IF;

  v_n := jsonb_array_length(NEW.items);

  IF v_tipus.es_checklist AND v_n = 0 THEN
    RAISE EXCEPTION 'El registre ha de tenir els ítems del checklist.';
  END IF;

  IF NOT v_tipus.es_checklist AND v_n = 0 AND (NEW.detall IS NULL OR NEW.detall = 'null'::jsonb) THEN
    RAISE EXCEPTION 'Aquest registre ha de tenir el detall de la fitxa.';
  END IF;

  IF v_n > 0 THEN
    FOR v_item IN SELECT value FROM jsonb_array_elements(NEW.items)
    LOOP
      IF coalesce(v_item->>'clau', '') = '' OR coalesce(v_item->>'etiqueta', '') = '' THEN
        RAISE EXCEPTION 'Cada ítem ha de tenir clau i etiqueta.';
      END IF;
      IF (v_item->>'ok') IS NULL OR (v_item->>'ok') NOT IN ('true', 'false') THEN
        RAISE EXCEPTION 'Cada ítem ha de respondre sí o no.';
      END IF;
    END LOOP;

    NEW.incidencia_detectada := EXISTS (
      SELECT 1
      FROM jsonb_array_elements(NEW.items) AS el(value)
      WHERE el.value->>'ok' = 'false'
    );
  END IF;

  IF v_tipus.unic_per_periode AND EXISTS (
    SELECT 1
    FROM public.obrador_registres_torn
    WHERE tipus_codi = NEW.tipus_codi
      AND periode_inici = NEW.periode_inici
      AND id IS DISTINCT FROM NEW.id
  ) THEN
    RAISE EXCEPTION 'Ja hi ha un registre d''aquest tipus per aquest període.';
  END IF;

  IF v_tipus.maxim_per_periode IS NOT NULL THEN
    SELECT count(*) INTO v_fets
    FROM public.obrador_registres_torn
    WHERE tipus_codi = NEW.tipus_codi
      AND periode_inici = NEW.periode_inici
      AND id IS DISTINCT FROM NEW.id;
    IF v_fets >= v_tipus.maxim_per_periode THEN
      RAISE EXCEPTION 'Aquest període ja té el màxim de registres (%).', v_tipus.maxim_per_periode;
    END IF;
  END IF;

  IF auth.uid() IS NOT NULL THEN
    NEW.registrat_per := auth.uid();
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

UPDATE public.obrador_tipus_registre
SET actiu = false, updated_at = now()
WHERE codi = 'neteja_cuina';

INSERT INTO public.obrador_tipus_registre
  (codi, etiqueta, codis_pla, frequencia, unic_per_periode, es_checklist, actiu, llindar, maxim_per_periode)
VALUES
  ('neteja_setmanal', 'Neteja setmanal', ARRAY['neteja'], 'setmanal', true, true, true, NULL, NULL),
  ('neteja_forn', 'Neteja del forn', ARRAY['neteja'], 'setmanal', false, true, true, NULL, 2),
  ('neteja_mensual', 'Neteja mensual', ARRAY['neteja'], 'mensual', true, true, true, NULL, NULL),
  ('neteja_congelador', 'Neteja del congelador', ARRAY['neteja'], 'trimestral', true, true, true, NULL, NULL)
ON CONFLICT (codi) DO UPDATE SET
  etiqueta = EXCLUDED.etiqueta,
  codis_pla = EXCLUDED.codis_pla,
  frequencia = EXCLUDED.frequencia,
  unic_per_periode = EXCLUDED.unic_per_periode,
  es_checklist = EXCLUDED.es_checklist,
  actiu = EXCLUDED.actiu,
  maxim_per_periode = EXCLUDED.maxim_per_periode,
  updated_at = now();
