-- =============================================================================
-- Obrador Ac3 — estat d'ús + codi intern dels proveïdors (llistat Compres 2026)
--
-- Executar a Supabase SQL Editor DESPRÉS de:
--   - create_obrador_ac3_tables.sql
--   - alter_obrador_proveidors_holded.sql (cif / holded_*)
--
-- No esborra proveïdors. "inactiu" = amagat al selector, no esborra històric.
-- =============================================================================

ALTER TABLE public.obrador_proveidors
  ADD COLUMN IF NOT EXISTS estat_us TEXT NOT NULL DEFAULT 'habitual',
  ADD COLUMN IF NOT EXISTS codi_intern TEXT;

-- Si la columna ja existia sense check, normalitza valors i afegeix constraint
UPDATE public.obrador_proveidors
SET estat_us = 'habitual'
WHERE estat_us IS NULL
   OR estat_us NOT IN ('habitual', 'ocasional', 'inactiu', 'revisar');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'obrador_proveidors_estat_us_check'
      AND conrelid = 'public.obrador_proveidors'::regclass
  ) THEN
    ALTER TABLE public.obrador_proveidors
      ADD CONSTRAINT obrador_proveidors_estat_us_check
      CHECK (estat_us IN ('habitual', 'ocasional', 'inactiu', 'revisar'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_obrador_proveidors_estat_us
  ON public.obrador_proveidors (estat_us);

CREATE INDEX IF NOT EXISTS idx_obrador_proveidors_codi_intern
  ON public.obrador_proveidors (codi_intern)
  WHERE codi_intern IS NOT NULL AND codi_intern <> '';

COMMENT ON COLUMN public.obrador_proveidors.estat_us IS
  'habitual | ocasional | inactiu | revisar — selector mostra habitual+ocasional per defecte';

COMMENT ON COLUMN public.obrador_proveidors.codi_intern IS
  'Codi del llistat oficial Compres (CSV proveidors_obrador_2026)';
