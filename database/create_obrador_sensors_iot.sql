-- =============================================================================
-- Obrador Ac3 — Sensors IoT (Milesight EM320-TH + TTN) — pas 1 / esquema
--
-- Opció A: ampliar obrador_incidencies per episodis de sensor (id_lot nullable).
--
-- Executar a Supabase SQL Editor DESPRÉS de:
--   - create_obrador_ac3_tables.sql
--   - alter_obrador_ac3_v2.sql (tipus temperatures / incidències)
--   - alter_obrador_rls_hardening.sql (funcions RLS, recomanat)
--
-- Llindars APPCC: NULL fins que Cristina els defineixi.
-- Valors de prova (només simulador): veure comentaris als INSERT seed.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. obrador_sensors
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.obrador_sensors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dev_eui TEXT NOT NULL,
  nom TEXT NOT NULL,
  ubicacio TEXT NOT NULL,
  -- Tipus físic / APPCC (plan Ac3)
  tipus TEXT NOT NULL CHECK (tipus IN ('camara_fred', 'congelador', 'ambient')),
  -- Tipus per escriure a obrador_temperatures.tipus (mapa estable)
  tipus_lectura TEXT NOT NULL DEFAULT 'refrigeracio'
    CHECK (tipus_lectura IN ('refrigeracio', 'congelacio', 'conservacio', 'zonaProduccio')),
  -- Llindars °C — NULL = pendent APPCC (Cristina). No inventar valors de producció.
  llindar_min DECIMAL(5,2),
  llindar_max DECIMAL(5,2),
  -- Minuts fora de rang abans d'obrir incidència. NULL = pendent APPCC.
  minuts_tolerancia INTEGER,
  -- Sense senyal (default 30 min segons pla)
  minuts_sense_senyal INTEGER NOT NULL DEFAULT 30,
  actiu BOOLEAN NOT NULL DEFAULT false,
  ultima_lectura_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT obrador_sensors_dev_eui_unique UNIQUE (dev_eui),
  CONSTRAINT obrador_sensors_llindar_order CHECK (
    llindar_min IS NULL OR llindar_max IS NULL OR llindar_min < llindar_max
  )
);

CREATE INDEX IF NOT EXISTS idx_obrador_sensors_actiu ON public.obrador_sensors (actiu);
CREATE INDEX IF NOT EXISTS idx_obrador_sensors_ubicacio ON public.obrador_sensors (ubicacio);

COMMENT ON TABLE public.obrador_sensors IS
  'Configuració sensors LoRaWAN (Milesight EM320-TH). Llindars NULL fins APPCC.';
COMMENT ON COLUMN public.obrador_sensors.llindar_min IS
  'Pendent Cristina/APPCC. No usar valors inventats en producció.';
COMMENT ON COLUMN public.obrador_sensors.llindar_max IS
  'Pendent Cristina/APPCC. No usar valors inventats en producció.';
COMMENT ON COLUMN public.obrador_sensors.minuts_tolerancia IS
  'Pendent APPCC. Per simulador es pot omplir temporalment.';

ALTER TABLE public.obrador_sensors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS obrador_sensors_select_staff ON public.obrador_sensors;
CREATE POLICY obrador_sensors_select_staff ON public.obrador_sensors
  FOR SELECT TO authenticated
  USING (
    public.obrador_is_portal_staff_user()
    OR public.obrador_is_management_user()
  );

DROP POLICY IF EXISTS obrador_sensors_write_management ON public.obrador_sensors;
CREATE POLICY obrador_sensors_write_management ON public.obrador_sensors
  FOR ALL TO authenticated
  USING (public.obrador_is_management_user())
  WITH CHECK (public.obrador_is_management_user());

-- -----------------------------------------------------------------------------
-- 2. obrador_temperatures — vincle sensor + humitat + anti-duplicats
-- -----------------------------------------------------------------------------
ALTER TABLE public.obrador_temperatures
  ADD COLUMN IF NOT EXISTS sensor_id UUID REFERENCES public.obrador_sensors(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS humitat DECIMAL(5,2);

CREATE INDEX IF NOT EXISTS idx_obrador_temperatures_sensor_id
  ON public.obrador_temperatures (sensor_id);

-- Retransmissions EM320-TH: una lectura per sensor + timestamp
CREATE UNIQUE INDEX IF NOT EXISTS idx_obrador_temperatures_sensor_mesura_unique
  ON public.obrador_temperatures (sensor_id, mesura_at)
  WHERE sensor_id IS NOT NULL;

COMMENT ON COLUMN public.obrador_temperatures.sensor_id IS
  'FK opcional (lectures manuals sense sensor segueixen vàlides).';
COMMENT ON COLUMN public.obrador_temperatures.humitat IS
  'Humitat relativa % (EM320-TH). Nullable si el decoder no la porta.';

-- -----------------------------------------------------------------------------
-- 3. obrador_incidencies — Opció A: episodis IoT (id_lot opcional)
-- -----------------------------------------------------------------------------
ALTER TABLE public.obrador_incidencies
  ALTER COLUMN id_lot DROP NOT NULL;

ALTER TABLE public.obrador_incidencies
  ADD COLUMN IF NOT EXISTS id_sensor UUID REFERENCES public.obrador_sensors(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS origen TEXT NOT NULL DEFAULT 'lot',
  ADD COLUMN IF NOT EXISTS valor_extrem DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS tancada_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS inici_episodi_at TIMESTAMPTZ;

-- origen
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'obrador_incidencies_origen_check'
      AND conrelid = 'public.obrador_incidencies'::regclass
  ) THEN
    ALTER TABLE public.obrador_incidencies
      ADD CONSTRAINT obrador_incidencies_origen_check
      CHECK (origen IN ('lot', 'sensor'));
  END IF;
END $$;

-- tipus ampliat (lot + sensor)
ALTER TABLE public.obrador_incidencies DROP CONSTRAINT IF EXISTS obrador_incidencies_tipus_check;
ALTER TABLE public.obrador_incidencies
  ADD CONSTRAINT obrador_incidencies_tipus_check
  CHECK (
    tipus IS NULL OR tipus IN (
      'temperatura', 'qualitat', 'contaminacio', 'etiquetatge', 'altres',
      'sensor_fora_rang', 'sensor_sense_senyal'
    )
  );

-- Coherència: lot → id_lot; sensor → id_sensor
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'obrador_incidencies_origen_refs_check'
      AND conrelid = 'public.obrador_incidencies'::regclass
  ) THEN
    ALTER TABLE public.obrador_incidencies
      ADD CONSTRAINT obrador_incidencies_origen_refs_check
      CHECK (
        (origen = 'lot' AND id_lot IS NOT NULL)
        OR (origen = 'sensor' AND id_sensor IS NOT NULL)
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_obrador_incidencies_sensor
  ON public.obrador_incidencies (id_sensor)
  WHERE id_sensor IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_obrador_incidencies_origen_estat
  ON public.obrador_incidencies (origen, estat);

-- Una sola incidència oberta per sensor + tipus (episodi)
CREATE UNIQUE INDEX IF NOT EXISTS idx_obrador_incidencies_sensor_oberta_unique
  ON public.obrador_incidencies (id_sensor, tipus)
  WHERE origen = 'sensor' AND estat = 'oberta' AND id_sensor IS NOT NULL;

COMMENT ON COLUMN public.obrador_incidencies.origen IS
  'lot = incidència de traçabilitat; sensor = alerta IoT';
COMMENT ON COLUMN public.obrador_incidencies.valor_extrem IS
  'Màxim o mínim assolit durant l''episodi fora de rang';
COMMENT ON COLUMN public.obrador_incidencies.inici_episodi_at IS
  'Inici de l''episodi (primera lectura fora de rang / detecció sense senyal)';

-- -----------------------------------------------------------------------------
-- 4. Seed 5 sensors (ubicacions del pla) — actiu=false fins hardware / simulador
--    DevEUI placeholders: substituir pels reals de l'etiqueta Milesight.
--    Llindars NULL (APPCC). Per provar alertes al simulador, omplir-los a mà.
-- -----------------------------------------------------------------------------
INSERT INTO public.obrador_sensors (
  dev_eui, nom, ubicacio, tipus, tipus_lectura, actiu, notes
)
VALUES
  (
    '0000000000000001',
    'Cambra fred 1',
    'Cambra fred 1',
    'camara_fred',
    'refrigeracio',
    false,
    'PLACEHOLDER DevEUI — substituir. Llindars APPCC pendents (Cristina).'
  ),
  (
    '0000000000000002',
    'Cambra fred 2',
    'Cambra fred 2',
    'camara_fred',
    'refrigeracio',
    false,
    'PLACEHOLDER DevEUI — substituir. Llindars APPCC pendents (Cristina).'
  ),
  (
    '0000000000000003',
    'Congelador',
    'Congelador',
    'congelador',
    'congelacio',
    false,
    'PLACEHOLDER DevEUI — substituir. Llindars APPCC pendents (Cristina).'
  ),
  (
    '0000000000000004',
    'Producció',
    'Producció',
    'ambient',
    'zonaProduccio',
    false,
    'PLACEHOLDER DevEUI — substituir. Llindars APPCC pendents (Cristina).'
  ),
  (
    '0000000000000005',
    'Magatzem sec',
    'Magatzem sec',
    'ambient',
    'conservacio',
    false,
    'PLACEHOLDER DevEUI — substituir. Llindars APPCC pendents (Cristina).'
  )
ON CONFLICT (dev_eui) DO NOTHING;
