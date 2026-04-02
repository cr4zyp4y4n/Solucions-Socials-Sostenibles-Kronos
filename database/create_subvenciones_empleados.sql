-- Tabla puente: empleados presentados a una subvención (Holded)
-- Ejecutar en Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.subvenciones_empleados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subvencion_id UUID NOT NULL REFERENCES public.subvenciones(id) ON DELETE CASCADE,

  -- Holded employee id (string)
  empleado_holded_id TEXT NOT NULL,
  empleado_nombre TEXT,

  -- presentado | aceptado | rechazado
  estado TEXT NOT NULL DEFAULT 'presentado'
    CHECK (estado IN ('presentado', 'aceptado', 'rechazado')),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Un empleado no debería repetirse dentro de la misma subvención
CREATE UNIQUE INDEX IF NOT EXISTS subvenciones_empleados_unique
  ON public.subvenciones_empleados(subvencion_id, empleado_holded_id);

CREATE INDEX IF NOT EXISTS subvenciones_empleados_subvencion_id_idx
  ON public.subvenciones_empleados(subvencion_id);

-- RLS
ALTER TABLE public.subvenciones_empleados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subvenciones_empleados_select"
  ON public.subvenciones_empleados
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "subvenciones_empleados_insert"
  ON public.subvenciones_empleados
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "subvenciones_empleados_update"
  ON public.subvenciones_empleados
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "subvenciones_empleados_delete"
  ON public.subvenciones_empleados
  FOR DELETE
  TO authenticated
  USING (true);

-- Trigger updated_at (usa la función si ya existe en tu proyecto)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column'
  ) THEN
    DROP TRIGGER IF EXISTS update_subvenciones_empleados_updated_at ON public.subvenciones_empleados;
    CREATE TRIGGER update_subvenciones_empleados_updated_at
      BEFORE UPDATE ON public.subvenciones_empleados
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Nota: si quieres guardar la FASE de forma explícita (independiente del estado),
-- ejecuta también este ALTER en tu tabla de subvenciones:
-- ALTER TABLE public.subvenciones ADD COLUMN IF NOT EXISTS fase_actual INTEGER;

