-- =============================================================================
-- Obrador Ac3 — Migració v2 (schema consolidat per a la implementació Kronos)
-- =============================================================================
-- PREREQUISIT: executar abans database/create_obrador_ac3_tables.sql si les
--              taules encara no existeixen.
--
-- Ús: Supabase → SQL Editor → executar aquest fitxer sencer (idempotent).
--     Es pot reexecutar sense error si algunes columnes ja existeixen.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. RECEPCIONS — camps operatius
-- -----------------------------------------------------------------------------
ALTER TABLE obrador_recepcions
  ADD COLUMN IF NOT EXISTS estat TEXT DEFAULT 'bo',
  ADD COLUMN IF NOT EXISTS caducitat DATE,
  ADD COLUMN IF NOT EXISTS congelat BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS observacions TEXT,
  ADD COLUMN IF NOT EXISTS operari TEXT,
  ADD COLUMN IF NOT EXISTS id_operari UUID REFERENCES obrador_operaris(id) ON DELETE SET NULL;

-- CHECK estat recepció (drop + add per si ja existia una versió anterior)
ALTER TABLE obrador_recepcions DROP CONSTRAINT IF EXISTS obrador_recepcions_estat_check;
ALTER TABLE obrador_recepcions
  ADD CONSTRAINT obrador_recepcions_estat_check
  CHECK (estat IS NULL OR estat IN ('bo', 'regular', 'rebutjat'));

CREATE INDEX IF NOT EXISTS idx_obrador_recepcions_estat ON obrador_recepcions(estat);
CREATE INDEX IF NOT EXISTS idx_obrador_recepcions_operari ON obrador_recepcions(id_operari);

-- -----------------------------------------------------------------------------
-- 2. PRODUCTES — fitxa tècnica i al·lèrgens
-- -----------------------------------------------------------------------------
ALTER TABLE obrador_productes
  ADD COLUMN IF NOT EXISTS allergens TEXT[],
  ADD COLUMN IF NOT EXISTS temp_coccio DECIMAL(4,1),
  ADD COLUMN IF NOT EXISTS temp_conservacio DECIMAL(4,1),
  ADD COLUMN IF NOT EXISTS fitxa_tecnica TEXT,
  ADD COLUMN IF NOT EXISTS actiu BOOLEAN DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_obrador_productes_actiu ON obrador_productes(actiu);

-- -----------------------------------------------------------------------------
-- 3. LOTS — codi, estat, mostra, quantitat
-- -----------------------------------------------------------------------------
ALTER TABLE obrador_lots
  ADD COLUMN IF NOT EXISTS codi_lot TEXT,
  ADD COLUMN IF NOT EXISTS estat TEXT DEFAULT 'produit',
  ADD COLUMN IF NOT EXISTS mostra_guardada BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS quantitat_kg DECIMAL(6,2),
  ADD COLUMN IF NOT EXISTS observacions TEXT;

ALTER TABLE obrador_lots DROP CONSTRAINT IF EXISTS obrador_lots_estat_check;
ALTER TABLE obrador_lots
  ADD CONSTRAINT obrador_lots_estat_check
  CHECK (estat IS NULL OR estat IN ('produit', 'envasat', 'expedit', 'retirat'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_obrador_lots_codi_lot
  ON obrador_lots(codi_lot) WHERE codi_lot IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_obrador_lots_estat ON obrador_lots(estat);

-- -----------------------------------------------------------------------------
-- 4. ETIQUETES — al·lèrgens i QR únic
-- -----------------------------------------------------------------------------
ALTER TABLE obrador_etiquetes
  ADD COLUMN IF NOT EXISTS allergens TEXT[];

CREATE UNIQUE INDEX IF NOT EXISTS idx_obrador_etiquetes_codi_qr
  ON obrador_etiquetes(codi_qr) WHERE codi_qr IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 5. EXPEDICIONS — verificació client i notes
-- -----------------------------------------------------------------------------
ALTER TABLE obrador_expedicions
  ADD COLUMN IF NOT EXISTS check_client BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS observacions TEXT;

-- -----------------------------------------------------------------------------
-- 6. INCIDÈNCIES — tipus normalitzat
-- -----------------------------------------------------------------------------
ALTER TABLE obrador_incidencies DROP CONSTRAINT IF EXISTS obrador_incidencies_tipus_check;
ALTER TABLE obrador_incidencies
  ADD CONSTRAINT obrador_incidencies_tipus_check
  CHECK (
    tipus IS NULL OR tipus IN (
      'temperatura', 'qualitat', 'contaminacio', 'etiquetatge', 'altres'
    )
  );

-- -----------------------------------------------------------------------------
-- 7. TEMPERATURES IoT — tipus per al dashboard (refrigeració, congelació…)
-- -----------------------------------------------------------------------------
ALTER TABLE obrador_temperatures
  ADD COLUMN IF NOT EXISTS tipus TEXT DEFAULT 'refrigeracio';

ALTER TABLE obrador_temperatures DROP CONSTRAINT IF EXISTS obrador_temperatures_tipus_check;
ALTER TABLE obrador_temperatures
  ADD CONSTRAINT obrador_temperatures_tipus_check
  CHECK (
    tipus IS NULL OR tipus IN (
      'refrigeracio', 'congelacio', 'conservacio', 'zonaProduccio'
    )
  );

-- Política UPDATE per temperatures (el schema base només tenia SELECT/INSERT/DELETE)
DROP POLICY IF EXISTS "obrador_temperatures_update" ON obrador_temperatures;
CREATE POLICY "obrador_temperatures_update" ON obrador_temperatures
  FOR UPDATE TO authenticated
  USING (
    auth.role() = 'authenticated'
    AND (
      EXISTS (
        SELECT 1 FROM public.user_profiles up
        WHERE up.id = auth.uid()
          AND lower(coalesce(up.role, '')) IN ('admin', 'management', 'manager', 'jefe', 'administrador', 'gestion', 'gestión')
      )
      OR lower(coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '')) IN ('admin', 'management', 'manager', 'jefe', 'administrador', 'gestion', 'gestión')
    )
  )
  WITH CHECK (
    auth.role() = 'authenticated'
    AND (
      EXISTS (
        SELECT 1 FROM public.user_profiles up
        WHERE up.id = auth.uid()
          AND lower(coalesce(up.role, '')) IN ('admin', 'management', 'manager', 'jefe', 'administrador', 'gestion', 'gestión')
      )
      OR lower(coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '')) IN ('admin', 'management', 'manager', 'jefe', 'administrador', 'gestion', 'gestión')
    )
  );

-- -----------------------------------------------------------------------------
-- 8. Funció: generar codi de lot (Europe/Madrid, evita duplicats obvis)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.obrador_generar_codi_lot()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prefix text;
  seq integer;
  candidat text;
  intents integer := 0;
BEGIN
  prefix := 'LOT-' || to_char(now() AT TIME ZONE 'Europe/Madrid', 'YYYYMMDD') || '-';

  LOOP
    SELECT count(*) + 1
    INTO seq
    FROM obrador_lots
    WHERE codi_lot LIKE prefix || '%';

    candidat := prefix || lpad(seq::text, 3, '0');

    IF NOT EXISTS (SELECT 1 FROM obrador_lots WHERE codi_lot = candidat) THEN
      RETURN candidat;
    END IF;

    intents := intents + 1;
    IF intents > 50 THEN
      RAISE EXCEPTION 'No s''ha pogut generar un codi de lot únic per avui';
    END IF;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.obrador_generar_codi_lot() IS
  'Genera LOT-YYYYMMDD-NNN en zona Europe/Madrid. Usar des del servei o trigger.';

-- -----------------------------------------------------------------------------
-- 9. Trigger opcional: omplir codi_lot si ve buit en INSERT
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.obrador_lots_set_codi_lot()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.codi_lot IS NULL OR btrim(NEW.codi_lot) = '' THEN
    NEW.codi_lot := public.obrador_generar_codi_lot();
  END IF;
  IF NEW.estat IS NULL THEN
    NEW.estat := 'produit';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_obrador_lots_set_codi_lot ON obrador_lots;
CREATE TRIGGER trg_obrador_lots_set_codi_lot
  BEFORE INSERT ON obrador_lots
  FOR EACH ROW
  EXECUTE FUNCTION public.obrador_lots_set_codi_lot();

-- Trigger updated_at en UPDATE
CREATE OR REPLACE FUNCTION public.obrador_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_obrador_lots_touch ON obrador_lots;
CREATE TRIGGER trg_obrador_lots_touch
  BEFORE UPDATE ON obrador_lots
  FOR EACH ROW EXECUTE FUNCTION public.obrador_touch_updated_at();

DROP TRIGGER IF EXISTS trg_obrador_recepcions_touch ON obrador_recepcions;
CREATE TRIGGER trg_obrador_recepcions_touch
  BEFORE UPDATE ON obrador_recepcions
  FOR EACH ROW EXECUTE FUNCTION public.obrador_touch_updated_at();

DROP TRIGGER IF EXISTS trg_obrador_expedicions_touch ON obrador_expedicions;
CREATE TRIGGER trg_obrador_expedicions_touch
  BEFORE UPDATE ON obrador_expedicions
  FOR EACH ROW EXECUTE FUNCTION public.obrador_touch_updated_at();

DROP TRIGGER IF EXISTS trg_obrador_incidencies_touch ON obrador_incidencies;
CREATE TRIGGER trg_obrador_incidencies_touch
  BEFORE UPDATE ON obrador_incidencies
  FOR EACH ROW EXECUTE FUNCTION public.obrador_touch_updated_at();

-- -----------------------------------------------------------------------------
-- 10. Dades de prova (idempotents — no duplica per nom)
-- -----------------------------------------------------------------------------
INSERT INTO obrador_proveidors (nom, contacte)
SELECT v.nom, v.contacte
FROM (VALUES
  ('Fruites Montserrat', '93 123 45 67'),
  ('Carns Paco', '93 234 56 78'),
  ('Làctics del Vallès', '93 345 67 89')
) AS v(nom, contacte)
WHERE NOT EXISTS (
  SELECT 1 FROM obrador_proveidors p WHERE p.nom = v.nom
);

INSERT INTO obrador_productes (nom, caducitat_dies, temp_coccio, temp_conservacio, allergens, actiu)
SELECT v.nom, v.caducitat_dies, v.temp_coccio, v.temp_conservacio, v.allergens, true
FROM (VALUES
  ('Croquetes de pollastre', 3, 75.0::decimal, 4.0::decimal, ARRAY['gluten', 'ou']::text[]),
  ('Arròs amb verdures', 2, 85.0::decimal, 4.0::decimal, ARRAY['gluten']::text[]),
  ('Crema de carbassa', 4, 90.0::decimal, 4.0::decimal, ARRAY[]::text[])
) AS v(nom, caducitat_dies, temp_coccio, temp_conservacio, allergens)
WHERE NOT EXISTS (
  SELECT 1 FROM obrador_productes p WHERE p.nom = v.nom
);

INSERT INTO obrador_operaris (nom, rol)
SELECT v.nom, v.rol
FROM (VALUES
  ('Cristina López', 'cap_obrador'),
  ('Marc Fernández', 'operari'),
  ('Laura Puig', 'operari')
) AS v(nom, rol)
WHERE NOT EXISTS (
  SELECT 1 FROM obrador_operaris o WHERE o.nom = v.nom
);

-- Temperatures de demo per al dashboard (només si la taula està buida)
INSERT INTO obrador_temperatures (ubicacio, valor, tipus, mesura_at)
SELECT v.ubicacio, v.valor, v.tipus, now()
FROM (VALUES
  ('Cambra 1 refrigeració', 2.5::decimal, 'refrigeracio'),
  ('Cambra 2 refrigeració', 5.5::decimal, 'refrigeracio'),
  ('Cambra 3 congelació', -19.0::decimal, 'congelacio'),
  ('Cambra 4 conservació', 5.0::decimal, 'conservacio'),
  ('Zona producció', 21.0::decimal, 'zonaProduccio')
) AS v(ubicacio, valor, tipus)
WHERE NOT EXISTS (SELECT 1 FROM obrador_temperatures LIMIT 1);

-- -----------------------------------------------------------------------------
-- Fi migració v2
-- Comprovació ràpida:
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'obrador_lots' AND column_name IN ('codi_lot','estat','observacions');
--   SELECT obrador_generar_codi_lot();
-- =============================================================================
