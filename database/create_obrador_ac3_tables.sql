-- =============================================================================
-- OBrador Ac3 — InnvESS 2026. Àrea de Digitalització
-- Model de dades: traçabilitat Lot (Proveïdor → Recepció → Lot → Expedició/Etiqueta/Incidència)
-- Executar al SQL Editor de Supabase (en un sol bloc o per seccions).
-- =============================================================================

-- Extensión para UUIDs (si no la tens ja)
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
-- 2. RECEPCIÓ (1 proveïdor → N recepcions)
-- =============================================================================
CREATE TABLE IF NOT EXISTS obrador_recepcions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  id_proveidor UUID NOT NULL REFERENCES obrador_proveidors(id) ON DELETE RESTRICT,
  data_recepcio TIMESTAMPTZ NOT NULL DEFAULT now(),
  lot_proveidor TEXT,
  temperatura_arribada DECIMAL(5,2),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_obrador_recepcions_proveidor ON obrador_recepcions(id_proveidor);
CREATE INDEX IF NOT EXISTS idx_obrador_recepcions_data ON obrador_recepcions(data_recepcio DESC);

-- =============================================================================
-- 3. PRODUCTE
-- =============================================================================
CREATE TABLE IF NOT EXISTS obrador_productes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nom TEXT NOT NULL,
  caducitat_dies INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_obrador_productes_nom ON obrador_productes(nom);

-- =============================================================================
-- 4. OPERARI
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
-- 5. LOT (nucli: recepció + producte + operari)
-- =============================================================================
CREATE TABLE IF NOT EXISTS obrador_lots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  id_recepcio UUID NOT NULL REFERENCES obrador_recepcions(id) ON DELETE RESTRICT,
  id_producte UUID NOT NULL REFERENCES obrador_productes(id) ON DELETE RESTRICT,
  id_operari UUID REFERENCES obrador_operaris(id) ON DELETE SET NULL,
  data_produccio TIMESTAMPTZ NOT NULL DEFAULT now(),
  temp_final_coccio DECIMAL(5,2),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_obrador_lots_recepcio ON obrador_lots(id_recepcio);
CREATE INDEX IF NOT EXISTS idx_obrador_lots_producte ON obrador_lots(id_producte);
CREATE INDEX IF NOT EXISTS idx_obrador_lots_operari ON obrador_lots(id_operari);
CREATE INDEX IF NOT EXISTS idx_obrador_lots_data_produccio ON obrador_lots(data_produccio DESC);

-- =============================================================================
-- 6. ETIQUETA (1 lot → 1 etiqueta; es genera en l'envasat)
-- =============================================================================
CREATE TABLE IF NOT EXISTS obrador_etiquetes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  id_lot UUID NOT NULL REFERENCES obrador_lots(id) ON DELETE CASCADE,
  codi_qr TEXT,
  data_caducitat DATE,
  data_envasat TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(id_lot)
);

CREATE INDEX IF NOT EXISTS idx_obrador_etiquetes_lot ON obrador_etiquetes(id_lot);
CREATE INDEX IF NOT EXISTS idx_obrador_etiquetes_caducitat ON obrador_etiquetes(data_caducitat);
CREATE INDEX IF NOT EXISTS idx_obrador_etiquetes_data_envasat ON obrador_etiquetes(data_envasat DESC);

-- =============================================================================
-- 7. EXPEDICIÓ (1 lot → 1 expedició; comanda_holded = integració ERP)
-- =============================================================================
CREATE TABLE IF NOT EXISTS obrador_expedicions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  id_lot UUID NOT NULL REFERENCES obrador_lots(id) ON DELETE CASCADE,
  id_client TEXT,
  data_sortida TIMESTAMPTZ NOT NULL DEFAULT now(),
  comanda_holded TEXT,
  estat TEXT DEFAULT 'en trànsit' CHECK (estat IN ('en trànsit', 'entregat')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_obrador_expedicions_lot ON obrador_expedicions(id_lot);
CREATE INDEX IF NOT EXISTS idx_obrador_expedicions_data_sortida ON obrador_expedicions(data_sortida DESC);
CREATE INDEX IF NOT EXISTS idx_obrador_expedicions_estat ON obrador_expedicions(estat);

-- =============================================================================
-- 8. INCIDÈNCIA (1 lot → N incidències)
-- =============================================================================
CREATE TABLE IF NOT EXISTS obrador_incidencies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  id_lot UUID NOT NULL REFERENCES obrador_lots(id) ON DELETE CASCADE,
  tipus TEXT,
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
-- RLS (Row Level Security)
-- =============================================================================
ALTER TABLE obrador_proveidors ENABLE ROW LEVEL SECURITY;
ALTER TABLE obrador_recepcions ENABLE ROW LEVEL SECURITY;
ALTER TABLE obrador_productes ENABLE ROW LEVEL SECURITY;
ALTER TABLE obrador_operaris ENABLE ROW LEVEL SECURITY;
ALTER TABLE obrador_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE obrador_etiquetes ENABLE ROW LEVEL SECURITY;
ALTER TABLE obrador_expedicions ENABLE ROW LEVEL SECURITY;
ALTER TABLE obrador_incidencies ENABLE ROW LEVEL SECURITY;

-- Polítiques: usuaris autenticats poden fer SELECT, INSERT, UPDATE, DELETE
-- (pots restringir per rol amb user_profiles si ho necessites)

CREATE POLICY "obrador_proveidors_select" ON obrador_proveidors FOR SELECT TO authenticated USING (true);
CREATE POLICY "obrador_proveidors_insert" ON obrador_proveidors FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "obrador_proveidors_update" ON obrador_proveidors FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "obrador_proveidors_delete" ON obrador_proveidors FOR DELETE TO authenticated USING (true);

CREATE POLICY "obrador_recepcions_select" ON obrador_recepcions FOR SELECT TO authenticated USING (true);
CREATE POLICY "obrador_recepcions_insert" ON obrador_recepcions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "obrador_recepcions_update" ON obrador_recepcions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "obrador_recepcions_delete" ON obrador_recepcions FOR DELETE TO authenticated USING (true);

CREATE POLICY "obrador_productes_select" ON obrador_productes FOR SELECT TO authenticated USING (true);
CREATE POLICY "obrador_productes_insert" ON obrador_productes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "obrador_productes_update" ON obrador_productes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "obrador_productes_delete" ON obrador_productes FOR DELETE TO authenticated USING (true);

CREATE POLICY "obrador_operaris_select" ON obrador_operaris FOR SELECT TO authenticated USING (true);
CREATE POLICY "obrador_operaris_insert" ON obrador_operaris FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "obrador_operaris_update" ON obrador_operaris FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "obrador_operaris_delete" ON obrador_operaris FOR DELETE TO authenticated USING (true);

CREATE POLICY "obrador_lots_select" ON obrador_lots FOR SELECT TO authenticated USING (true);
CREATE POLICY "obrador_lots_insert" ON obrador_lots FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "obrador_lots_update" ON obrador_lots FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "obrador_lots_delete" ON obrador_lots FOR DELETE TO authenticated USING (true);

CREATE POLICY "obrador_etiquetes_select" ON obrador_etiquetes FOR SELECT TO authenticated USING (true);
CREATE POLICY "obrador_etiquetes_insert" ON obrador_etiquetes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "obrador_etiquetes_update" ON obrador_etiquetes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "obrador_etiquetes_delete" ON obrador_etiquetes FOR DELETE TO authenticated USING (true);

CREATE POLICY "obrador_expedicions_select" ON obrador_expedicions FOR SELECT TO authenticated USING (true);
CREATE POLICY "obrador_expedicions_insert" ON obrador_expedicions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "obrador_expedicions_update" ON obrador_expedicions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "obrador_expedicions_delete" ON obrador_expedicions FOR DELETE TO authenticated USING (true);

CREATE POLICY "obrador_incidencies_select" ON obrador_incidencies FOR SELECT TO authenticated USING (true);
CREATE POLICY "obrador_incidencies_insert" ON obrador_incidencies FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "obrador_incidencies_update" ON obrador_incidencies FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "obrador_incidencies_delete" ON obrador_incidencies FOR DELETE TO authenticated USING (true);

-- =============================================================================
-- (Opcional) Taula de temperatures IoT — per al dashboard en temps real
-- Si els sensors escriuen directament a Supabase, una taula com aquesta.
-- =============================================================================
CREATE TABLE IF NOT EXISTS obrador_temperatures (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ubicacio TEXT NOT NULL,
  valor DECIMAL(5,2) NOT NULL,
  mesura_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_obrador_temperatures_ubicacio ON obrador_temperatures(ubicacio);
CREATE INDEX IF NOT EXISTS idx_obrador_temperatures_mesura_at ON obrador_temperatures(mesura_at DESC);

ALTER TABLE obrador_temperatures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "obrador_temperatures_select" ON obrador_temperatures FOR SELECT TO authenticated USING (true);
CREATE POLICY "obrador_temperatures_insert" ON obrador_temperatures FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "obrador_temperatures_delete" ON obrador_temperatures FOR DELETE TO authenticated USING (true);

-- =============================================================================
-- Fi. Taules creades: obrador_proveidors, obrador_recepcions, obrador_productes,
-- obrador_operaris, obrador_lots, obrador_etiquetes, obrador_expedicions,
-- obrador_incidencies, obrador_temperatures.
-- =============================================================================
