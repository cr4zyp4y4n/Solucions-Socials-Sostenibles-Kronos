-- =============================================================================
-- Obrador Ac3 — registres APPCC per torn (inici / producció / tancament)
-- Executar a SQL Editor (idempotent)
-- Un sol registre per dia i moment.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.obrador_registres_torn (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  moment TEXT NOT NULL CHECK (moment IN ('inici', 'produccio', 'tancament')),
  id_operari UUID REFERENCES public.obrador_operaris(id) ON DELETE SET NULL,
  registrat_per UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  incidencia_detectada BOOLEAN DEFAULT false,
  id_incidencia UUID REFERENCES public.obrador_incidencies(id) ON DELETE SET NULL,
  observacions TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_obrador_registres_torn_unic
  ON public.obrador_registres_torn (data, moment);

COMMENT ON TABLE public.obrador_registres_torn IS
  'Checklist APPCC d''inici, producció i tancament de torn. Un registre per dia i moment.';
COMMENT ON COLUMN public.obrador_registres_torn.moment IS
  'inici, produccio o tancament. L''índex únic impedeix repetir el mateix moment del mateix dia.';
COMMENT ON COLUMN public.obrador_registres_torn.id_operari IS
  'Operari del torn, si es coneix. Pot ser distint de qui registra la pantalla.';
COMMENT ON COLUMN public.obrador_registres_torn.registrat_per IS
  'Usuari autenticat que desa el checklist. El disparador el força amb auth.uid().';
COMMENT ON COLUMN public.obrador_registres_torn.items IS
  'Llista JSON [{ clau, etiqueta, ok, valor, nota }]. El text del checklist es canvia al codi, sense migració; aquí queda la còpia del dia.';
COMMENT ON COLUMN public.obrador_registres_torn.incidencia_detectada IS
  'Cert si algun ítem és no conforme, encara que no s''obri incidència.';
COMMENT ON COLUMN public.obrador_registres_torn.id_incidencia IS
  'Incidència oberta des d''aquest registre, si qui registra ha acceptat crear-la.';

ALTER TABLE public.obrador_registres_torn ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS obrador_registres_torn_select_staff ON public.obrador_registres_torn;
CREATE POLICY obrador_registres_torn_select_staff ON public.obrador_registres_torn
  FOR SELECT TO authenticated
  USING (
    public.obrador_is_portal_staff_user()
    OR public.obrador_is_management_user()
  );

DROP POLICY IF EXISTS obrador_registres_torn_write_management ON public.obrador_registres_torn;
CREATE POLICY obrador_registres_torn_write_management ON public.obrador_registres_torn
  FOR ALL TO authenticated
  USING (public.obrador_is_management_user())
  WITH CHECK (public.obrador_is_management_user());

-- Una no conformitat de torn no és un lot ni un sensor.
ALTER TABLE public.obrador_incidencies
  ALTER COLUMN id_lot DROP NOT NULL;

ALTER TABLE public.obrador_incidencies DROP CONSTRAINT IF EXISTS obrador_incidencies_origen_check;
ALTER TABLE public.obrador_incidencies
  ADD CONSTRAINT obrador_incidencies_origen_check
  CHECK (origen IN ('lot', 'sensor', 'torn'));

ALTER TABLE public.obrador_incidencies DROP CONSTRAINT IF EXISTS obrador_incidencies_origen_refs_check;
ALTER TABLE public.obrador_incidencies
  ADD CONSTRAINT obrador_incidencies_origen_refs_check
  CHECK (
    (origen = 'lot' AND id_lot IS NOT NULL)
    OR (origen = 'sensor' AND id_sensor IS NOT NULL)
    OR (origen = 'torn')
  );

COMMENT ON COLUMN public.obrador_incidencies.origen IS
  'lot = traçabilitat; sensor = alerta IoT; torn = no conformitat d''un registre APPCC de torn.';

CREATE OR REPLACE FUNCTION public.obrador_registres_torn_abans_desar()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_item jsonb;
BEGIN
  IF NEW.items IS NULL OR jsonb_typeof(NEW.items) <> 'array' OR jsonb_array_length(NEW.items) = 0 THEN
    RAISE EXCEPTION 'El registre de torn ha de tenir els ítems del checklist.';
  END IF;

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
