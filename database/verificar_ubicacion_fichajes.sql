-- Verificar y añadir columnas de ubicación en fichajes
-- Tabla: public.fichajes
-- Columnas: ubicacion_lat, ubicacion_lng, ubicacion_texto

-- 1) Comprobar si las columnas existen (ejecutar en SQL Editor y revisar resultado):
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'fichajes'
  AND column_name IN ('ubicacion_lat', 'ubicacion_lng', 'ubicacion_texto');

-- Si no salen las 3 filas, ejecutar el bloque siguiente para crearlas:

-- 2) Añadir columnas si no existen (mismo contenido que add_fichaje_ubicacion.sql):
ALTER TABLE public.fichajes
  ADD COLUMN IF NOT EXISTS ubicacion_lat DECIMAL(10, 7),
  ADD COLUMN IF NOT EXISTS ubicacion_lng DECIMAL(10, 7),
  ADD COLUMN IF NOT EXISTS ubicacion_texto TEXT;

COMMENT ON COLUMN public.fichajes.ubicacion_lat IS 'Latitud al registrar la entrada (opcional)';
COMMENT ON COLUMN public.fichajes.ubicacion_lng IS 'Longitud al registrar la entrada (opcional)';
COMMENT ON COLUMN public.fichajes.ubicacion_texto IS 'Texto de ubicación o dirección (opcional)';
