-- CIF/NIF del proveïdor (matching OCR d'albarans)
ALTER TABLE obrador_proveidors
  ADD COLUMN IF NOT EXISTS cif TEXT;

CREATE INDEX IF NOT EXISTS idx_obrador_proveidors_cif ON obrador_proveidors(cif);

-- Exemple Begudes del Vallès (ajusta si el nom a Supabase és diferent)
UPDATE obrador_proveidors
SET cif = 'A59801696'
WHERE nom ILIKE '%Begudes%' OR nom ILIKE '%BGRUP%';

-- Cuinats JOTRI S.L.U.
UPDATE obrador_proveidors
SET cif = 'B17209693'
WHERE nom ILIKE '%JOTRI%' OR nom ILIKE '%Cuinats Jotri%';
