-- Añade un campo explícito para la fase (1..8) independiente del estado
ALTER TABLE public.subvenciones
  ADD COLUMN IF NOT EXISTS fase_actual INTEGER;

-- (Opcional) índice para filtrar por fase
CREATE INDEX IF NOT EXISTS idx_subvenciones_fase_actual
  ON public.subvenciones(fase_actual);

