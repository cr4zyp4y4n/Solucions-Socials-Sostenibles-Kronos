-- =====================================================
-- Recordatorios SMS de fichaje (piloto)
-- Horario esperado + log de envíos (anti-duplicados)
-- =====================================================
-- Prueba inicial: Lizeth Cifuentes (Holded ANGIE LIZETH),
-- Lun–Vie 09:00–17:00, aviso a los 15 min (09:15 / 17:15).
-- Datos Holded ya en el seed; activar con activo=true tras desplegar worker.
-- =====================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- Horarios a vigilar (solo filas activas)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.fichajes_sms_horarios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empleado_id TEXT NOT NULL,
  nombre TEXT,
  telefono TEXT NOT NULL,
  -- Horas locales Europe/Madrid (HH:MM)
  hora_entrada TIME NOT NULL DEFAULT '09:00',
  hora_salida TIME NOT NULL DEFAULT '17:00',
  -- Minutos tras la hora esperada antes de enviar SMS
  tolerancia_minutos INTEGER NOT NULL DEFAULT 15
    CHECK (tolerancia_minutos >= 0 AND tolerancia_minutos <= 180),
  -- 1=lunes … 7=domingo (ISO); por defecto Lun–Vie
  dias_semana SMALLINT[] NOT NULL DEFAULT ARRAY[1, 2, 3, 4, 5],
  activo BOOLEAN NOT NULL DEFAULT true,
  timezone TEXT NOT NULL DEFAULT 'Europe/Madrid',
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fichajes_sms_horarios_empleado_unico UNIQUE (empleado_id)
);

CREATE INDEX IF NOT EXISTS idx_fichajes_sms_horarios_activo
  ON public.fichajes_sms_horarios (activo)
  WHERE activo = true;

COMMENT ON TABLE public.fichajes_sms_horarios IS
  'Empleados con horario esperado para recordatorios SMS de fichaje (entrada/salida).';

-- =====================================================
-- Log de SMS enviados (máx. 1 por tipo/día/empleado)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.fichajes_sms_envios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empleado_id TEXT NOT NULL,
  fecha DATE NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada_olvidada', 'salida_olvidada')),
  telefono TEXT,
  cuerpo TEXT,
  delivery TEXT, -- sms | debug | error
  error_message TEXT,
  enviado_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fichajes_sms_envios_unico UNIQUE (empleado_id, fecha, tipo)
);

CREATE INDEX IF NOT EXISTS idx_fichajes_sms_envios_fecha
  ON public.fichajes_sms_envios (fecha DESC);

CREATE INDEX IF NOT EXISTS idx_fichajes_sms_envios_empleado
  ON public.fichajes_sms_envios (empleado_id, fecha DESC);

COMMENT ON TABLE public.fichajes_sms_envios IS
  'Registro de recordatorios SMS de fichaje enviados (anti-duplicados).';

-- updated_at
CREATE OR REPLACE FUNCTION public.update_fichajes_sms_horarios_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_fichajes_sms_horarios_updated_at
  ON public.fichajes_sms_horarios;
CREATE TRIGGER trigger_fichajes_sms_horarios_updated_at
  BEFORE UPDATE ON public.fichajes_sms_horarios
  FOR EACH ROW
  EXECUTE FUNCTION public.update_fichajes_sms_horarios_updated_at();

-- =====================================================
-- RLS: lectura autenticados; escritura admin/management/manager
-- El worker usa service_role (bypass RLS).
-- =====================================================
ALTER TABLE public.fichajes_sms_horarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fichajes_sms_envios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth pueden ver horarios sms fichaje"
  ON public.fichajes_sms_horarios;
CREATE POLICY "Auth pueden ver horarios sms fichaje"
  ON public.fichajes_sms_horarios FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admin puede gestionar horarios sms fichaje"
  ON public.fichajes_sms_horarios;
CREATE POLICY "Admin puede gestionar horarios sms fichaje"
  ON public.fichajes_sms_horarios FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND up.role IN ('admin', 'management', 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND up.role IN ('admin', 'management', 'manager')
    )
  );

DROP POLICY IF EXISTS "Auth pueden ver envios sms fichaje"
  ON public.fichajes_sms_envios;
CREATE POLICY "Auth pueden ver envios sms fichaje"
  ON public.fichajes_sms_envios FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admin puede gestionar envios sms fichaje"
  ON public.fichajes_sms_envios;
CREATE POLICY "Admin puede gestionar envios sms fichaje"
  ON public.fichajes_sms_envios FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND up.role IN ('admin', 'management', 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND up.role IN ('admin', 'management', 'manager')
    )
  );

-- =====================================================
-- Seed piloto: Lizeth Cifuentes (Holded team/v1 → ANGIE LIZETH)
-- ID: 67ad13cdfcf0a25c3408e132 (email personal aliz.cifu@…, con móvil)
-- Nota: existe otra ficha homónima (67b89e1f…) con email gestio@… sin móvil; no usarla.
-- =====================================================
INSERT INTO public.fichajes_sms_horarios (
  empleado_id,
  nombre,
  telefono,
  hora_entrada,
  hora_salida,
  tolerancia_minutos,
  dias_semana,
  activo,
  timezone,
  notas
) VALUES (
  '67ad13cdfcf0a25c3408e132',
  'Lizeth Cifuentes (ANGIE LIZETH)',
  '603121839',
  '09:00',
  '17:00',
  15,
  ARRAY[1, 2, 3, 4, 5],
  false, -- poner activo=true cuando el cron + Edge Function estén listos
  'Europe/Madrid',
  'Piloto SMS fichaje. Holded id 67ad13cd… (no usar la ficha gestio@ sin móvil).'
)
ON CONFLICT (empleado_id) DO UPDATE SET
  nombre = EXCLUDED.nombre,
  telefono = EXCLUDED.telefono,
  hora_entrada = EXCLUDED.hora_entrada,
  hora_salida = EXCLUDED.hora_salida,
  tolerancia_minutos = EXCLUDED.tolerancia_minutos,
  dias_semana = EXCLUDED.dias_semana,
  timezone = EXCLUDED.timezone,
  notas = EXCLUDED.notas,
  updated_at = now();

-- Cuando esté desplegado el worker:
-- UPDATE public.fichajes_sms_horarios
-- SET activo = true
-- WHERE empleado_id = '67ad13cdfcf0a25c3408e132';
