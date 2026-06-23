-- Vincle proveïdors Obrador amb contactes Holded (import/sync)
ALTER TABLE obrador_proveidors
  ADD COLUMN IF NOT EXISTS cif TEXT,
  ADD COLUMN IF NOT EXISTS holded_contact_id TEXT,
  ADD COLUMN IF NOT EXISTS holded_empresa TEXT;

CREATE INDEX IF NOT EXISTS idx_obrador_proveidors_cif ON obrador_proveidors(cif);

CREATE UNIQUE INDEX IF NOT EXISTS idx_obrador_proveidors_holded_unique
  ON obrador_proveidors (holded_contact_id, holded_empresa)
  WHERE holded_contact_id IS NOT NULL AND holded_contact_id <> '';
