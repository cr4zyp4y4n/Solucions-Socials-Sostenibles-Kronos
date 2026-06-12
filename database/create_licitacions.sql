-- Mòdul Licitacions públiques (Kronos)
-- Executar al Supabase SQL Editor abans d'usar licitacionsService.js

CREATE TABLE IF NOT EXISTS public.licitacions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  source TEXT NOT NULL CHECK (source IN ('TED', 'PSCP', 'PLACSP')),
  external_id TEXT NOT NULL UNIQUE,

  title TEXT NOT NULL,
  organismo TEXT,
  sector TEXT,
  cpv_codes TEXT[] DEFAULT '{}',
  import_estimat NUMERIC,
  termini_oferta DATE,
  duracio TEXT,
  url TEXT,
  requisits TEXT,
  criteris TEXT,

  -- Estado del expediente en la fuente pública (PLACSP/PSCP/TED), no confundir con estat_jc
  estat_contractacio TEXT,
  estat_contractacio_label TEXT,
  fase_publicacio TEXT,
  ofertes_rebudes INTEGER,

  notes_paula TEXT,
  estat_jc TEXT NOT NULL DEFAULT 'Pendent'
    CHECK (estat_jc IN ('Pendent', 'Interessant', 'Descartada', 'Contactat')),
  data_contacte DATE,
  resultat_jc TEXT,

  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS licitacions_termini_oferta_idx
  ON public.licitacions (termini_oferta ASC NULLS LAST);

CREATE INDEX IF NOT EXISTS licitacions_sector_idx
  ON public.licitacions (sector);

CREATE INDEX IF NOT EXISTS licitacions_estat_jc_idx
  ON public.licitacions (estat_jc);

CREATE INDEX IF NOT EXISTS licitacions_source_idx
  ON public.licitacions (source);

CREATE INDEX IF NOT EXISTS licitacions_estat_contractacio_idx
  ON public.licitacions (estat_contractacio);

COMMENT ON TABLE public.licitacions IS
  'Licitacions públiques detectades (TED, PSCP, PLACSP) per seguiment comercial SSS.';

ALTER TABLE public.licitacions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "licitacions_select_authenticated" ON public.licitacions;
CREATE POLICY "licitacions_select_authenticated"
  ON public.licitacions FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "licitacions_insert_authenticated" ON public.licitacions;
CREATE POLICY "licitacions_insert_authenticated"
  ON public.licitacions FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "licitacions_update_authenticated" ON public.licitacions;
CREATE POLICY "licitacions_update_authenticated"
  ON public.licitacions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "licitacions_delete_authenticated" ON public.licitacions;
CREATE POLICY "licitacions_delete_authenticated"
  ON public.licitacions FOR DELETE TO authenticated USING (true);

-- Trigger updated_at (reutilitza la funció del projecte si existeix)
CREATE OR REPLACE FUNCTION public.licitacions_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS licitacions_updated_at ON public.licitacions;
CREATE TRIGGER licitacions_updated_at
  BEFORE UPDATE ON public.licitacions
  FOR EACH ROW EXECUTE FUNCTION public.licitacions_set_updated_at();
