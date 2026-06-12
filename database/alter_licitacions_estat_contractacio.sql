-- Estado del expediente (fuente pública), distinto de estat_jc (seguimiento comercial interno).
-- Ejecutar en Supabase SQL Editor si la tabla licitacions ya existía antes de este cambio.

ALTER TABLE public.licitacions
  ADD COLUMN IF NOT EXISTS estat_contractacio TEXT,
  ADD COLUMN IF NOT EXISTS estat_contractacio_label TEXT,
  ADD COLUMN IF NOT EXISTS fase_publicacio TEXT,
  ADD COLUMN IF NOT EXISTS ofertes_rebudes INTEGER;

CREATE INDEX IF NOT EXISTS licitacions_estat_contractacio_idx
  ON public.licitacions (estat_contractacio);

COMMENT ON COLUMN public.licitacions.estat_contractacio IS
  'Código normalizado del estado del expediente: PRE|PUB|EV|ADJ|RES|ANUL';
COMMENT ON COLUMN public.licitacions.estat_contractacio_label IS
  'Etiqueta legible del estado del expediente (español)';
COMMENT ON COLUMN public.licitacions.fase_publicacio IS
  'Fase de publicación original (PSCP/Catalunya)';
COMMENT ON COLUMN public.licitacions.ofertes_rebudes IS
  'Número de ofertas recibidas si la fuente lo publica';
