-- =============================================================================
-- Licitacions v2 — circuit comercial, històric, log de sync i configuració de filtres
--
-- Executar al Supabase SQL Editor DESPRÉS de:
--   database/create_licitacions.sql
--   database/alter_licitacions_estat_contractacio.sql
--
-- Idempotent: es pot tornar a executar sense trencar res.
-- No esborra cap columna existent (estat_jc es manté per compatibilitat).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Columnes noves a public.licitacions
-- -----------------------------------------------------------------------------
ALTER TABLE public.licitacions
  ADD COLUMN IF NOT EXISTS area TEXT,
  ADD COLUMN IF NOT EXISTS estat_circuit TEXT,
  ADD COLUMN IF NOT EXISTS responsable_area_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS data_traslladada TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS data_valorada TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS data_resolucio TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS motiu_descart TEXT,
  ADD COLUMN IF NOT EXISTS valoracio TEXT,
  ADD COLUMN IF NOT EXISTS reservada BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS contracte_menor BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS arxivada BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS arxivada_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

-- Backfill àrea des de sector (abans del CHECK)
UPDATE public.licitacions
SET area = CASE
  WHEN sector = 'Catering' THEN 'Catering'
  WHEN sector = 'Tecnologia' THEN 'Tech'
  ELSE 'Altres'
END
WHERE area IS NULL;

-- Backfill estat_circuit des d'estat_jc
-- DECISIÓ PENDENT (Brian/Sergi): 'Contactat' → 'Activada'. Si no és correcte, canviar abans d'executar.
UPDATE public.licitacions
SET estat_circuit = CASE estat_jc
  WHEN 'Pendent' THEN 'Detectada'
  WHEN 'Interessant' THEN 'Traslladada'
  WHEN 'Descartada' THEN 'Descartada'
  WHEN 'Contactat' THEN 'Activada'
  ELSE 'Detectada'
END
WHERE estat_circuit IS NULL;

ALTER TABLE public.licitacions
  ALTER COLUMN area SET DEFAULT 'Altres',
  ALTER COLUMN area SET NOT NULL,
  ALTER COLUMN estat_circuit SET DEFAULT 'Detectada',
  ALTER COLUMN estat_circuit SET NOT NULL;

ALTER TABLE public.licitacions DROP CONSTRAINT IF EXISTS licitacions_area_check;
ALTER TABLE public.licitacions
  ADD CONSTRAINT licitacions_area_check CHECK (area IN ('Catering', 'Tech', 'Altres'));

ALTER TABLE public.licitacions DROP CONSTRAINT IF EXISTS licitacions_estat_circuit_check;
ALTER TABLE public.licitacions
  ADD CONSTRAINT licitacions_estat_circuit_check
  CHECK (estat_circuit IN ('Detectada', 'Traslladada', 'Valorada', 'Descartada', 'Activada'));

-- Una descartada ha de tenir motiu. Les antigues reben un motiu genèric perquè
-- el CHECK no faci fallar les actualitzacions del sync sobre aquestes files.
UPDATE public.licitacions
SET motiu_descart = 'Sense motiu registrat (anterior a v2)'
WHERE estat_circuit = 'Descartada' AND coalesce(trim(motiu_descart), '') = '';

ALTER TABLE public.licitacions DROP CONSTRAINT IF EXISTS licitacions_descart_motiu_check;
ALTER TABLE public.licitacions
  ADD CONSTRAINT licitacions_descart_motiu_check
  CHECK (estat_circuit <> 'Descartada' OR coalesce(trim(motiu_descart), '') <> '');

CREATE INDEX IF NOT EXISTS licitacions_area_idx ON public.licitacions (area);
CREATE INDEX IF NOT EXISTS licitacions_estat_circuit_idx ON public.licitacions (estat_circuit);
CREATE INDEX IF NOT EXISTS licitacions_detected_at_idx ON public.licitacions (detected_at);
CREATE INDEX IF NOT EXISTS licitacions_arxivada_idx ON public.licitacions (arxivada);

COMMENT ON COLUMN public.licitacions.estat_circuit IS
  'Circuit comercial: Detectada → Traslladada → Valorada → Descartada | Activada. Substitueix estat_jc.';
COMMENT ON COLUMN public.licitacions.estat_jc IS
  'DEPRECAT: substituït per estat_circuit. Es manté per compatibilitat.';
COMMENT ON COLUMN public.licitacions.arxivada IS
  'Caducada/tancada. Ja no es mostra per defecte però NO s''esborra (cal per als acumulats).';
COMMENT ON COLUMN public.licitacions.reservada IS
  'Contracte reservat (DA 4a LCSP: empreses d''inserció / CEE) detectat per paraules clau.';

-- -----------------------------------------------------------------------------
-- 2. Històric de canvis d'estat (traçabilitat)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.licitacions_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  licitacio_id UUID NOT NULL REFERENCES public.licitacions(id) ON DELETE CASCADE,
  estat_anterior TEXT,
  estat_nou TEXT NOT NULL,
  nota TEXT,
  user_id UUID DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS licitacions_events_licitacio_idx ON public.licitacions_events (licitacio_id);
CREATE INDEX IF NOT EXISTS licitacions_events_created_idx ON public.licitacions_events (created_at);

ALTER TABLE public.licitacions_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "licitacions_events_select" ON public.licitacions_events;
CREATE POLICY "licitacions_events_select"
  ON public.licitacions_events FOR SELECT TO authenticated USING (true);
-- Sense policy d'INSERT/UPDATE/DELETE per a clients: només escriu el trigger (SECURITY DEFINER).

-- Trigger: registra cada canvi d'estat i omple les dates del circuit
CREATE OR REPLACE FUNCTION public.licitacions_circuit_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.licitacions_events (licitacio_id, estat_anterior, estat_nou, user_id)
    VALUES (NEW.id, NULL, NEW.estat_circuit, auth.uid());
    RETURN NEW;
  END IF;

  IF NEW.estat_circuit IS DISTINCT FROM OLD.estat_circuit THEN
    IF NEW.estat_circuit = 'Traslladada' AND NEW.data_traslladada IS NULL THEN
      NEW.data_traslladada := now();
    ELSIF NEW.estat_circuit = 'Valorada' AND NEW.data_valorada IS NULL THEN
      NEW.data_valorada := now();
    ELSIF NEW.estat_circuit IN ('Descartada', 'Activada') THEN
      NEW.data_resolucio := now();
    END IF;

    INSERT INTO public.licitacions_events (licitacio_id, estat_anterior, estat_nou, nota, user_id)
    VALUES (
      NEW.id,
      OLD.estat_circuit,
      NEW.estat_circuit,
      CASE WHEN NEW.estat_circuit = 'Descartada' THEN NEW.motiu_descart ELSE NULL END,
      auth.uid()
    );
  END IF;

  RETURN NEW;
END;
$$;

-- BEFORE UPDATE per poder omplir dates; AFTER INSERT perquè la fila ja existeixi (FK)
DROP TRIGGER IF EXISTS licitacions_circuit_upd ON public.licitacions;
CREATE TRIGGER licitacions_circuit_upd
  BEFORE UPDATE ON public.licitacions
  FOR EACH ROW EXECUTE FUNCTION public.licitacions_circuit_trigger();

DROP TRIGGER IF EXISTS licitacions_circuit_ins ON public.licitacions;
CREATE TRIGGER licitacions_circuit_ins
  AFTER INSERT ON public.licitacions
  FOR EACH ROW EXECUTE FUNCTION public.licitacions_circuit_trigger();

-- Esdeveniment inicial per a les files existents (una sola vegada)
INSERT INTO public.licitacions_events (licitacio_id, estat_anterior, estat_nou, nota, created_at, user_id)
SELECT l.id, NULL, l.estat_circuit, 'Migració v2 (estat inicial)', l.detected_at, NULL
FROM public.licitacions l
WHERE NOT EXISTS (SELECT 1 FROM public.licitacions_events e WHERE e.licitacio_id = l.id);

-- -----------------------------------------------------------------------------
-- 3. Log de sincronitzacions (evidència per al report setmanal)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.licitacions_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  origen TEXT NOT NULL CHECK (origen IN ('manual', 'cron_app', 'edge')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  ok BOOLEAN,
  -- {ted: n, pscp: n, placsp: n, placsp_menors: n} registres llegits de cada font
  llegits JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- {cpv: n, keyword: n, import: n} descartats pel filtre automàtic (no es desen)
  exclosos JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- {Catering: n, Tech: n, Altres: n} noves per àrea
  noves_per_area JSONB NOT NULL DEFAULT '{}'::jsonb,
  inserides INTEGER NOT NULL DEFAULT 0,
  actualitzades INTEGER NOT NULL DEFAULT 0,
  arxivades INTEGER NOT NULL DEFAULT 0,
  errors JSONB,
  user_id UUID DEFAULT auth.uid()
);

CREATE INDEX IF NOT EXISTS licitacions_sync_log_started_idx ON public.licitacions_sync_log (started_at DESC);

ALTER TABLE public.licitacions_sync_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "licitacions_sync_log_select" ON public.licitacions_sync_log;
CREATE POLICY "licitacions_sync_log_select"
  ON public.licitacions_sync_log FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "licitacions_sync_log_insert" ON public.licitacions_sync_log;
CREATE POLICY "licitacions_sync_log_insert"
  ON public.licitacions_sync_log FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "licitacions_sync_log_update" ON public.licitacions_sync_log;
CREATE POLICY "licitacions_sync_log_update"
  ON public.licitacions_sync_log FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- 4. Configuració de filtres editable sense release
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.licitacions_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  descripcio TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID DEFAULT auth.uid()
);

ALTER TABLE public.licitacions_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "licitacions_config_select" ON public.licitacions_config;
CREATE POLICY "licitacions_config_select"
  ON public.licitacions_config FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "licitacions_config_write_admin" ON public.licitacions_config;
CREATE POLICY "licitacions_config_write_admin"
  ON public.licitacions_config FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role IN ('management', 'admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role IN ('management', 'admin')));

-- Valors inicials (PROPOSTA — pendent de contrast amb els responsables de Càtering i Tech).
-- Els codis CPV es comparen per JERARQUIA: es treuen els zeros finals i es compara el prefix.
--   55520000 → '5552' (inclou 55521000, 55523100…)
INSERT INTO public.licitacions_config (key, value, descripcio) VALUES
  ('cpv_catering', '[
     "55300000", "55320000", "55321000", "55322000",
     "55520000",
     "15894200",
     "79952000", "79951000"
   ]'::jsonb,
   'CPV Càtering. Exclosos a propòsit: 55400000 (bars/begudes), 55500000/55510000 (cantina).'),
  ('cpv_tech', '[
     "72000000",
     "48000000",
     "50312000", "50320000",
     "32420000",
     "30200000",
     "80533000"
   ]'::jsonb,
   'CPV Tech/ASI: serveis TI, software, manteniment informàtic, xarxes, equips, formació TI.'),
  ('cpv_exclusio', '["55330000", "55400000", "55500000"]'::jsonb,
   'CPV exclosos encara que caiguin dins d''un prefix inclòs: cafeteria (5533), bars/begudes (554), cantina (555). S''avaluen ABANS que les llistes d''inclusió.'),
  ('cpv_altres', '[]'::jsonb,
   'Altres àrees (p. ex. 90700000 medi ambient). Buit = no es capten.'),
  ('keywords_exclusio', '{
     "Catering": ["bar", "bares", "cafeteria", "cafetería", "quiosc", "quiosco", "kiosco",
                  "vending", "màquines expenedores", "máquinas expendedoras", "chiringuito",
                  "explotació del bar", "explotación del bar", "explotación de la cafetería"],
     "Tech": []
   }'::jsonb,
   'Paraules (títol/objecte) que exclouen una licitació d''aquella àrea. Coincidència per paraula sencera, sense accents ni majúscules.'),
  ('keywords_reserva', '[
     "contrato reservado", "contracte reservat", "reservado a", "reservat a",
     "disposición adicional cuarta", "disposició addicional quarta",
     "empresas de inserción", "empreses d''inserció",
     "centros especiales de empleo", "centres especials de treball"
   ]'::jsonb,
   'Marquen la licitació com a reservada (DA 4a LCSP). Prioritat alta.'),
  ('import_max', '{"Catering": 60000, "Tech": 60000, "Altres": 60000}'::jsonb,
   'Import màxim (€ sense IVA) per àrea. Les licitacions sense import es capten igualment. null = sense límit.'),
  ('fonts_actives', '{"TED": false, "PSCP": true, "PLACSP": true, "PLACSP_MENORS": true}'::jsonb,
   'TED desactivat per defecte: només publica contractes per sobre del llindar UE.'),
  ('placsp_max_pages', '60'::jsonb,
   'Màxim de pàgines ATOM de PLACSP per sync. Si s''arriba al màxim sense arribar al tall, es registra com a incidència.')
ON CONFLICT (key) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 5. Vista per al report setmanal (comptadors per àrea i setmana)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.licitacions_report_setmanal
WITH (security_invoker = true) AS
SELECT
  date_trunc('week', e.created_at AT TIME ZONE 'Europe/Madrid')::date AS setmana,
  l.area,
  count(*) FILTER (WHERE e.estat_anterior IS NULL)        AS detectades,
  count(*) FILTER (WHERE e.estat_nou = 'Traslladada')     AS traslladades,
  count(*) FILTER (WHERE e.estat_nou = 'Valorada')        AS valorades,
  count(*) FILTER (WHERE e.estat_nou = 'Descartada')      AS descartades,
  count(*) FILTER (WHERE e.estat_nou = 'Activada')        AS activades
FROM public.licitacions_events e
JOIN public.licitacions l ON l.id = e.licitacio_id
GROUP BY 1, 2;

-- Verificar:
-- SELECT area, estat_circuit, count(*) FROM public.licitacions GROUP BY 1, 2 ORDER BY 1, 2;
-- SELECT * FROM public.licitacions_report_setmanal ORDER BY setmana DESC, area;
-- SELECT key, value FROM public.licitacions_config;
