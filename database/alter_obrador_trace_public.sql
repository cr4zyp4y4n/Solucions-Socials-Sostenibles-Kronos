-- Traçabilitat pública per QR d'etiquetes (lectura sense login)
-- Executar al Supabase SQL Editor abans de desplegar el portal amb ?trace=

CREATE OR REPLACE FUNCTION public.get_obrador_lot_public(p_codi text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  codi_norm text;
BEGIN
  codi_norm := trim(p_codi);
  IF codi_norm = '' THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'codi_lot', l.codi_lot,
    'codi_qr', e.codi_qr,
    'producte', p.nom,
    'data_produccio', l.data_produccio,
    'data_caducitat', e.data_caducitat,
    'allergens', COALESCE(e.allergens, p.allergens, ARRAY[]::text[]),
    'estat', l.estat,
    'quantitat_kg', l.quantitat_kg,
    'proveidor', prov.nom,
    'lot_proveidor', r.lot_proveidor,
    'data_recepcio', r.data_recepcio
  )
  INTO result
  FROM obrador_etiquetes e
  INNER JOIN obrador_lots l ON l.id = e.id_lot
  INNER JOIN obrador_productes p ON p.id = l.id_producte
  LEFT JOIN obrador_recepcions r ON r.id = l.id_recepcio
  LEFT JOIN obrador_proveidors prov ON prov.id = r.id_proveidor
  WHERE e.codi_qr = codi_norm
     OR l.codi_lot = codi_norm
  ORDER BY e.data_envasat DESC NULLS LAST
  LIMIT 1;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_obrador_lot_public(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_obrador_lot_public(text) TO anon, authenticated;

COMMENT ON FUNCTION public.get_obrador_lot_public(text) IS
  'Dades públiques d''un lot per escaneig QR (?trace=). Inclou proveïdor i recepció; sense operari ni observacions.';
