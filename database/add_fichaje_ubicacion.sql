-- Añadir columnas de ubicación al fichar (entrada)
-- Permite saber desde dónde ha fichado el empleado (ej. casa vs oficina)
ALTER TABLE fichajes
  ADD COLUMN IF NOT EXISTS ubicacion_lat DECIMAL(10, 7),
  ADD COLUMN IF NOT EXISTS ubicacion_lng DECIMAL(10, 7),
  ADD COLUMN IF NOT EXISTS ubicacion_texto TEXT;

COMMENT ON COLUMN fichajes.ubicacion_lat IS 'Latitud al registrar la entrada (opcional)';
COMMENT ON COLUMN fichajes.ubicacion_lng IS 'Longitud al registrar la entrada (opcional)';
COMMENT ON COLUMN fichajes.ubicacion_texto IS 'Texto de ubicación o dirección (ej. "Oficina", "Casa", o dirección)';
