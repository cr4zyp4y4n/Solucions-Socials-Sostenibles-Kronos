-- =============================================================================
-- Incidències — notes + checklist de tancament (lot / sensor)
-- Executar a SQL Editor (idempotent)
-- =============================================================================

ALTER TABLE public.obrador_incidencies
  ADD COLUMN IF NOT EXISTS notes_tancament TEXT,
  ADD COLUMN IF NOT EXISTS checklist_tancament JSONB;

COMMENT ON COLUMN public.obrador_incidencies.checklist_tancament IS
  'Respostes SI/NO del tancament manual (revisió lot o sensor).';
COMMENT ON COLUMN public.obrador_incidencies.notes_tancament IS
  'Observacions lliures en tancar la incidència.';
