-- =============================================================================
-- Incidències — estat "en_curs" (En revisió) per episodis IoT reconeguts
-- Executar a SQL Editor DESPRÉS de create_obrador_sensors_iot.sql
-- =============================================================================

-- Ampliar check d'estat
ALTER TABLE public.obrador_incidencies
  DROP CONSTRAINT IF EXISTS obrador_incidencies_estat_check;

ALTER TABLE public.obrador_incidencies
  ADD CONSTRAINT obrador_incidencies_estat_check
  CHECK (estat IS NULL OR estat IN ('oberta', 'en_curs', 'tancada'));

-- Episodi actiu = oberta O en_curs (no obrir duplicats)
DROP INDEX IF EXISTS idx_obrador_incidencies_sensor_oberta_unique;

CREATE UNIQUE INDEX IF NOT EXISTS idx_obrador_incidencies_sensor_activa_unique
  ON public.obrador_incidencies (id_sensor, tipus)
  WHERE origen = 'sensor'
    AND estat IN ('oberta', 'en_curs')
    AND id_sensor IS NOT NULL;

COMMENT ON CONSTRAINT obrador_incidencies_estat_check ON public.obrador_incidencies IS
  'oberta=alerta nova; en_curs=reconeguda en revisió; tancada=tancada amb checklist/auto';
