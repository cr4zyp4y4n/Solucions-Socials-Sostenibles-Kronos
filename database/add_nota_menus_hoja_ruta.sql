-- Añade la columna nota a hojas_ruta_menus.
-- La columna E del CSV es la NOTA que hace referencia al ítem de menú de la columna D.
-- Ejecutar en el SQL Editor de Supabase.

ALTER TABLE public.hojas_ruta_menus
  ADD COLUMN IF NOT EXISTS nota TEXT;

COMMENT ON COLUMN public.hojas_ruta_menus.nota IS 'Nota que hace referencia al ítem de menú (columna E de la hoja de ruta)';
