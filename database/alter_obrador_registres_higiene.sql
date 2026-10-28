  -- =============================================================================
  -- Plans d'higiene: tipus de registre sobre obrador_registres_torn
  -- Executar després de database/alter_obrador_recepcio_completa.sql
  -- No esborra files. Si un moment de torn no encaixa, s'atura.
  -- =============================================================================

  CREATE TABLE IF NOT EXISTS public.obrador_tipus_registre (
    codi TEXT PRIMARY KEY,
    etiqueta TEXT NOT NULL,
    codis_pla TEXT[] NOT NULL,
    frequencia TEXT NOT NULL CHECK (frequencia IN ('diari', 'setmanal', 'mensual', 'esdeveniment')),
    unic_per_periode BOOLEAN NOT NULL,
    es_checklist BOOLEAN NOT NULL DEFAULT true,
    actiu BOOLEAN NOT NULL DEFAULT true,
    llindar JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
  );

  COMMENT ON TABLE public.obrador_tipus_registre IS
    'Metadades del tipus de registre. Els ítems del checklist viuen al codi, no aquí.';
  COMMENT ON COLUMN public.obrador_tipus_registre.codis_pla IS
    'Plans d''higiene als quals pertany. Un registre en pot tenir més d''un.';
  COMMENT ON COLUMN public.obrador_tipus_registre.llindar IS
    'Lloc buit per al límit crític. El fixa l''empresa d''APPCC. No s''hi posa cap número per defecte.';
  COMMENT ON COLUMN public.obrador_tipus_registre.es_checklist IS
    'Cert si el registre és una llista de sí/no. Fals si té forma pròpia (formació, residus, manteniment).';

  ALTER TABLE public.obrador_tipus_registre ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS obrador_tipus_registre_select_staff ON public.obrador_tipus_registre;
  CREATE POLICY obrador_tipus_registre_select_staff ON public.obrador_tipus_registre
    FOR SELECT TO authenticated
    USING (
      public.obrador_is_portal_staff_user()
      OR public.obrador_is_management_user()
    );

  DROP POLICY IF EXISTS obrador_tipus_registre_write_management ON public.obrador_tipus_registre;
  CREATE POLICY obrador_tipus_registre_write_management ON public.obrador_tipus_registre
    FOR ALL TO authenticated
    USING (public.obrador_is_management_user())
    WITH CHECK (public.obrador_is_management_user());

  INSERT INTO public.obrador_tipus_registre
    (codi, etiqueta, codis_pla, frequencia, unic_per_periode, es_checklist, actiu, llindar)
  VALUES
    ('torn_inici', 'Inici de torn', ARRAY['torn', 'temperatures', 'neteja'], 'diari', true, true, true, NULL),
    ('torn_produccio', 'Producció', ARRAY['torn'], 'diari', true, true, true, NULL),
    ('torn_tancament', 'Tancament de torn', ARRAY['torn', 'neteja', 'residus'], 'diari', true, true, true, NULL),
    ('aigua_clor', 'Nivell de clor lliure residual', ARRAY['control_aigua'], 'diari', true, false, true, NULL),
    ('neteja_cuina', 'Neteja de cuina i magatzem', ARRAY['neteja'], 'diari', true, true, false, NULL),
    ('formacio_sessio', 'Sessió de formació', ARRAY['formacio'], 'esdeveniment', false, false, true, NULL),
    ('temperatures_equips', 'Equips de conservació', ARRAY['temperatures'], 'diari', true, true, true, NULL),
    ('residus_retirada', 'Retirada de residus', ARRAY['residus'], 'diari', true, false, true, NULL),
    ('manteniment_equips', 'Manteniment d''instal·lacions i equips', ARRAY['manteniment'], 'esdeveniment', false, false, true, NULL)
  ON CONFLICT (codi) DO UPDATE SET
    etiqueta = EXCLUDED.etiqueta,
    codis_pla = EXCLUDED.codis_pla,
    frequencia = EXCLUDED.frequencia,
    unic_per_periode = EXCLUDED.unic_per_periode,
    es_checklist = EXCLUDED.es_checklist,
    actiu = EXCLUDED.actiu,
    updated_at = now();

  ALTER TABLE public.obrador_registres_torn
    ADD COLUMN IF NOT EXISTS tipus_codi TEXT REFERENCES public.obrador_tipus_registre(codi),
    ADD COLUMN IF NOT EXISTS periode_inici DATE,
    ADD COLUMN IF NOT EXISTS detall JSONB,
    ADD COLUMN IF NOT EXISTS origen_extern BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS document_adjunt_path TEXT;

  COMMENT ON COLUMN public.obrador_registres_torn.origen_extern IS
    'Previst per a un registre fet per una empresa externa (control de plagues). Encara no s''hi carrega res.';
  COMMENT ON COLUMN public.obrador_registres_torn.document_adjunt_path IS
    'Previst per al certificat o document de l''empresa externa. Buit fins que es pugui adjuntar.';
  COMMENT ON COLUMN public.obrador_registres_torn.detall IS
    'Dades dels registres que no són un checklist: formació, residus o manteniment.';

  DO $$
  DECLARE
    n_estrany integer;
    n_migrats integer;
  BEGIN
    SELECT count(*) INTO n_estrany
    FROM public.obrador_registres_torn
    WHERE moment IS NULL OR moment NOT IN ('inici', 'produccio', 'tancament');

    IF n_estrany > 0 THEN
      RAISE EXCEPTION
        'Hi ha % registres de torn amb un moment que no és inici, produccio ni tancament. No es migra res.',
        n_estrany;
    END IF;

    UPDATE public.obrador_registres_torn
    SET
      tipus_codi = CASE moment
        WHEN 'inici' THEN 'torn_inici'
        WHEN 'produccio' THEN 'torn_produccio'
        WHEN 'tancament' THEN 'torn_tancament'
      END,
      periode_inici = data
    WHERE tipus_codi IS NULL;

    GET DIAGNOSTICS n_migrats = ROW_COUNT;
    RAISE NOTICE 'Registres de torn migrats a tipus_codi: %', n_migrats;
  END $$;

  ALTER TABLE public.obrador_registres_torn
    ALTER COLUMN tipus_codi SET NOT NULL;

  UPDATE public.obrador_registres_torn
  SET periode_inici = data
  WHERE periode_inici IS NULL;

  ALTER TABLE public.obrador_registres_torn
    ALTER COLUMN periode_inici SET NOT NULL;

  ALTER TABLE public.obrador_registres_torn
    ALTER COLUMN moment DROP NOT NULL;

  ALTER TABLE public.obrador_registres_torn
    DROP CONSTRAINT IF EXISTS obrador_registres_torn_moment_check;

  ALTER TABLE public.obrador_registres_torn
    ADD CONSTRAINT obrador_registres_torn_moment_check
    CHECK (moment IS NULL OR moment IN ('inici', 'produccio', 'tancament'));

  DROP INDEX IF EXISTS public.idx_obrador_registres_torn_unic;

  COMMENT ON TABLE public.obrador_registres_torn IS
    'Registres dels plans d''higiene i del torn. El tipus diu la freqüència. moment es conserva només als tres torns.';
  COMMENT ON COLUMN public.obrador_registres_torn.moment IS
    'Deute. Sincronitzat amb tipus_codi als torns (inici, produccio, tancament). Nul a la resta. Retirar quan no el llegeixi ningú.';
  COMMENT ON COLUMN public.obrador_registres_torn.tipus_codi IS
    'Tipus de registre. Els ítems signats queden a items, tal com eren aquell dia.';
  COMMENT ON COLUMN public.obrador_registres_torn.periode_inici IS
    'Primer dia del període que cobreix el registre. En un diari és el dia; en un mensual, el dia 1.';

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

  DROP TRIGGER IF EXISTS trg_obrador_registres_torn_abans_desar ON public.obrador_registres_torn;
  CREATE TRIGGER trg_obrador_registres_torn_abans_desar
    BEFORE INSERT OR UPDATE ON public.obrador_registres_torn
    FOR EACH ROW
    EXECUTE FUNCTION public.obrador_registres_torn_abans_desar();

  -- Incidència lligada al registre. Es conserven lot, sensor, torn i recepció.
  ALTER TABLE public.obrador_incidencies
    ADD COLUMN IF NOT EXISTS id_recepcio UUID REFERENCES public.obrador_recepcions(id) ON DELETE RESTRICT;

  ALTER TABLE public.obrador_incidencies
    ADD COLUMN IF NOT EXISTS id_registre UUID REFERENCES public.obrador_registres_torn(id) ON DELETE RESTRICT;

  COMMENT ON COLUMN public.obrador_incidencies.id_registre IS
    'Registre d''higiene d''origen quan origen = registre.';

  ALTER TABLE public.obrador_incidencies DROP CONSTRAINT IF EXISTS obrador_incidencies_origen_check;
  ALTER TABLE public.obrador_incidencies
    ADD CONSTRAINT obrador_incidencies_origen_check
    CHECK (origen IN ('lot', 'sensor', 'torn', 'recepcio', 'registre'));

  ALTER TABLE public.obrador_incidencies DROP CONSTRAINT IF EXISTS obrador_incidencies_origen_refs_check;
  ALTER TABLE public.obrador_incidencies
    ADD CONSTRAINT obrador_incidencies_origen_refs_check
    CHECK (
      (origen = 'lot' AND id_lot IS NOT NULL)
      OR (origen = 'sensor' AND id_sensor IS NOT NULL)
      OR (origen = 'torn')
      OR (origen = 'recepcio' AND id_recepcio IS NOT NULL)
      OR (origen = 'registre' AND id_registre IS NOT NULL)
    );

  COMMENT ON COLUMN public.obrador_incidencies.origen IS
    'lot = traçabilitat; sensor = alerta IoT; torn = no conformitat d''un torn; recepcio = entrada de matèria primera; registre = un registre d''higiene.';

  CREATE INDEX IF NOT EXISTS idx_obrador_incidencies_registre
    ON public.obrador_incidencies (id_registre)
    WHERE id_registre IS NOT NULL;

  CREATE INDEX IF NOT EXISTS idx_obrador_registres_torn_tipus_periode
    ON public.obrador_registres_torn (tipus_codi, periode_inici);
