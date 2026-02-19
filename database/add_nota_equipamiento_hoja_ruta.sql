-- Añade la columna nota a hojas_ruta_equipamiento.
-- La columna C del CSV es la NOTA IMPORTANTE que hace referencia al ítem de la columna A.
-- Ejecutar en el SQL Editor de Supabase.

ALTER TABLE public.hojas_ruta_equipamiento
  ADD COLUMN IF NOT EXISTS nota TEXT;

COMMENT ON COLUMN public.hojas_ruta_equipamiento.nota IS 'Nota importante que hace referencia al ítem (columna C de la hoja de ruta)';
