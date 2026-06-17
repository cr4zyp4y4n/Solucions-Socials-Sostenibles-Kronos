-- =============================================================================
-- Obrador Ac3 — InnvESS 2026. Àrea de Digitalització
-- Model de dades: traçabilitat Lot (Proveïdor → Recepció → Lot → Expedició/Etiqueta/Incidència)
--
-- ORDRE D'EXECUCIÓ:
--   1. Aquest fitxer (creació de taules)
--   2. database/alter_obrador_ac3_v2.sql (funcions, triggers, dades de prova)
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- 1. PROVEÏDOR
-- =============================================================================
CREATE TABLE IF NOT EXISTS obrador_proveidors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nom TEXT NOT NULL,
  contacte TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_obrador_proveidors_nom ON obrador_proveidors(nom);

-- =============================================================================
-- 2. OPERARI (abans de recepcions/lots per FK opcional)
-- =============================================================================
CREATE TABLE IF NOT EXISTS obrador_operaris (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nom TEXT NOT NULL,
  rol TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_obrador_operaris_rol ON obrador_operaris(rol);

-- =============================================================================
-- 3. RECEPCIÓ
-- =============================================================================
CREATE TABLE IF NOT EXISTS obrador_recepcions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  id_proveidor UUID NOT NULL REFERENCES obrador_proveidors(id) ON DELETE RESTRICT,
  data_recepcio TIMESTAMPTZ NOT NULL DEFAULT now(),
  lot_proveidor TEXT,
  temperatura_arribada DECIMAL(5,2),
  estat TEXT DEFAULT 'bo' CHECK (estat IS NULL OR estat IN ('bo', 'regular', 'rebutjat')),
  caducitat DATE,
  congelat BOOLEAN DEFAULT false,
  observacions TEXT,
  operari TEXT,
  id_operari UUID REFERENCES obrador_operaris(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_obrador_recepcions_proveidor ON obrador_recepcions(id_proveidor);
CREATE INDEX IF NOT EXISTS idx_obrador_recepcions_data ON obrador_recepcions(data_recepcio DESC);
CREATE INDEX IF NOT EXISTS idx_obrador_recepcions_estat ON obrador_recepcions(estat);
CREATE INDEX IF NOT EXISTS idx_obrador_recepcions_operari ON obrador_recepcions(id_operari);

-- =============================================================================
-- 4. PRODUCTE
-- =============================================================================
CREATE TABLE IF NOT EXISTS obrador_productes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nom TEXT NOT NULL,
  caducitat_dies INTEGER,
  allergens TEXT[],
  temp_coccio DECIMAL(4,1),
  temp_conservacio DECIMAL(4,1),
  fitxa_tecnica TEXT,
  actiu BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_obrador_productes_nom ON obrador_productes(nom);
CREATE INDEX IF NOT EXISTS idx_obrador_productes_actiu ON obrador_productes(actiu);

-- =============================================================================
-- 5. LOT
-- =============================================================================
CREATE TABLE IF NOT EXISTS obrador_lots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  id_recepcio UUID NOT NULL REFERENCES obrador_recepcions(id) ON DELETE RESTRICT,
  id_producte UUID NOT NULL REFERENCES obrador_productes(id) ON DELETE RESTRICT,
  id_operari UUID REFERENCES obrador_operaris(id) ON DELETE SET NULL,
  codi_lot TEXT,
  data_produccio TIMESTAMPTZ NOT NULL DEFAULT now(),
  temp_final_coccio DECIMAL(5,2),
  estat TEXT DEFAULT 'produit' CHECK (estat IS NULL OR estat IN ('produit', 'envasat', 'expedit', 'retirat')),
  mostra_guardada BOOLEAN DEFAULT false,
  quantitat_kg DECIMAL(6,2),
  observacions TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_obrador_lots_codi_lot
  ON obrador_lots(codi_lot) WHERE codi_lot IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_obrador_lots_recepcio ON obrador_lots(id_recepcio);
CREATE INDEX IF NOT EXISTS idx_obrador_lots_producte ON obrador_lots(id_producte);
CREATE INDEX IF NOT EXISTS idx_obrador_lots_operari ON obrador_lots(id_operari);
CREATE INDEX IF NOT EXISTS idx_obrador_lots_data_produccio ON obrador_lots(data_produccio DESC);
CREATE INDEX IF NOT EXISTS idx_obrador_lots_estat ON obrador_lots(estat);

-- =============================================================================
-- 6. ETIQUETA
-- =============================================================================
CREATE TABLE IF NOT EXISTS obrador_etiquetes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  id_lot UUID NOT NULL REFERENCES obrador_lots(id) ON DELETE CASCADE,
  codi_qr TEXT,
  data_caducitat DATE,
  data_envasat TIMESTAMPTZ DEFAULT now(),
  allergens TEXT[],
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(id_lot)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_obrador_etiquetes_codi_qr
  ON obrador_etiquetes(codi_qr) WHERE codi_qr IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_obrador_etiquetes_lot ON obrador_etiquetes(id_lot);
CREATE INDEX IF NOT EXISTS idx_obrador_etiquetes_caducitat ON obrador_etiquetes(data_caducitat);
CREATE INDEX IF NOT EXISTS idx_obrador_etiquetes_data_envasat ON obrador_etiquetes(data_envasat DESC);

-- =============================================================================
-- 7. EXPEDICIÓ
-- =============================================================================
CREATE TABLE IF NOT EXISTS obrador_expedicions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  id_lot UUID NOT NULL REFERENCES obrador_lots(id) ON DELETE CASCADE,
  id_client TEXT,
  data_sortida TIMESTAMPTZ NOT NULL DEFAULT now(),
  comanda_holded TEXT,
  estat TEXT DEFAULT 'en trànsit' CHECK (estat IN ('en trànsit', 'entregat')),
  check_client BOOLEAN DEFAULT false,
  observacions TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_obrador_expedicions_lot ON obrador_expedicions(id_lot);
CREATE INDEX IF NOT EXISTS idx_obrador_expedicions_data_sortida ON obrador_expedicions(data_sortida DESC);
CREATE INDEX IF NOT EXISTS idx_obrador_expedicions_estat ON obrador_expedicions(estat);

-- =============================================================================
-- 8. INCIDÈNCIA
-- =============================================================================
CREATE TABLE IF NOT EXISTS obrador_incidencies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  id_lot UUID NOT NULL REFERENCES obrador_lots(id) ON DELETE CASCADE,
  tipus TEXT CHECK (
    tipus IS NULL OR tipus IN (
      'temperatura', 'qualitat', 'contaminacio', 'etiquetatge', 'altres'
    )
  ),
  descripcio TEXT NOT NULL,
  data_incidencia TIMESTAMPTZ NOT NULL DEFAULT now(),
  estat TEXT DEFAULT 'oberta' CHECK (estat IN ('oberta', 'tancada')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_obrador_incidencies_lot ON obrador_incidencies(id_lot);
CREATE INDEX IF NOT EXISTS idx_obrador_incidencies_data ON obrador_incidencies(data_incidencia DESC);
CREATE INDEX IF NOT EXISTS idx_obrador_incidencies_estat ON obrador_incidencies(estat);

-- =============================================================================
-- 9. TEMPERATURES IoT
-- =============================================================================
CREATE TABLE IF NOT EXISTS obrador_temperatures (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ubicacio TEXT NOT NULL,
  valor DECIMAL(5,2) NOT NULL,
  tipus TEXT DEFAULT 'refrigeracio' CHECK (
    tipus IS NULL OR tipus IN (
      'refrigeracio', 'congelacio', 'conservacio', 'zonaProduccio'
    )
  ),
  mesura_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_obrador_temperatures_ubicacio ON obrador_temperatures(ubicacio);
CREATE INDEX IF NOT EXISTS idx_obrador_temperatures_mesura_at ON obrador_temperatures(mesura_at DESC);

-- =============================================================================
-- RLS
-- =============================================================================
ALTER TABLE obrador_proveidors ENABLE ROW LEVEL SECURITY;
ALTER TABLE obrador_recepcions ENABLE ROW LEVEL SECURITY;
ALTER TABLE obrador_productes ENABLE ROW LEVEL SECURITY;
ALTER TABLE obrador_operaris ENABLE ROW LEVEL SECURITY;
ALTER TABLE obrador_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE obrador_etiquetes ENABLE ROW LEVEL SECURITY;
ALTER TABLE obrador_expedicions ENABLE ROW LEVEL SECURITY;
ALTER TABLE obrador_incidencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE obrador_temperatures ENABLE ROW LEVEL SECURITY;

-- Polítiques (idempotents amb DROP IF EXISTS)
DO $$
DECLARE
  t text;
  pol text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'obrador_proveidors', 'obrador_recepcions', 'obrador_productes', 'obrador_operaris',
    'obrador_lots', 'obrador_etiquetes', 'obrador_expedicions', 'obrador_incidencies',
    'obrador_temperatures'
  ]
  LOOP
    FOREACH pol IN ARRAY ARRAY['select', 'insert', 'update', 'delete']
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_' || pol, t);
      IF pol = 'select' THEN
        EXECUTE format(
          'CREATE POLICY %I ON %I FOR SELECT TO authenticated USING (true)',
          t || '_' || pol, t
        );
      ELSIF pol = 'insert' THEN
        EXECUTE format(
          'CREATE POLICY %I ON %I FOR INSERT TO authenticated WITH CHECK (true)',
          t || '_' || pol, t
        );
      ELSIF pol = 'update' THEN
        EXECUTE format(
          'CREATE POLICY %I ON %I FOR UPDATE TO authenticated USING (true) WITH CHECK (true)',
          t || '_' || pol, t
        );
      ELSE
        EXECUTE format(
          'CREATE POLICY %I ON %I FOR DELETE TO authenticated USING (true)',
          t || '_' || pol, t
        );
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- =============================================================================
-- Següent pas: database/alter_obrador_ac3_v2.sql
-- =============================================================================
