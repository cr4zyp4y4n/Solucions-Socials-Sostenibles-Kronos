-- Expedició: separar verificació sortida (obrador) vs recepció client
ALTER TABLE obrador_expedicions
  ADD COLUMN IF NOT EXISTS check_sortida BOOLEAN DEFAULT false;

COMMENT ON COLUMN obrador_expedicions.check_sortida IS
  'Producte verificat a l''obrador/abans de sortir (estat, etiquetatge, temperatura).';

COMMENT ON COLUMN obrador_expedicions.check_client IS
  'Client ha rebut i acceptat el producte a destí (marcar en entregar).';
