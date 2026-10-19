-- =============================================================================
-- Incidències — qui tanca l'acció correctiva i qui verifica que ha estat efectiva
-- Executar a SQL Editor (idempotent)
-- =============================================================================
-- tancada_per: persona autenticada que tanca la incidència.
-- verificada_per: persona (pot ser una altra) que comprova que la correcció
-- ha funcionat. No és qui l'ha executada.
-- =============================================================================

ALTER TABLE public.obrador_incidencies
  ADD COLUMN IF NOT EXISTS tancada_per UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS verificada_per UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS verificada_at TIMESTAMPTZ;

COMMENT ON COLUMN public.obrador_incidencies.tancada_per IS
  'Usuari autenticat que tanca la incidència i deixa constància de l''acció correctiva.';
COMMENT ON COLUMN public.obrador_incidencies.verificada_per IS
  'Usuari de gestió que comprova que l''acció correctiva ha estat efectiva. Pot ser una persona distinta de tancada_per.';
COMMENT ON COLUMN public.obrador_incidencies.verificada_at IS
  'Moment en què es verifica que l''acció correctiva ha estat efectiva.';

-- Només el nom, i només per a gestió. Així el llistat pot dir qui ha tancat
-- sense obrir la lectura de tot user_profiles.
CREATE OR REPLACE FUNCTION public.obrador_noms_perfils(p_ids uuid[])
RETURNS TABLE (id uuid, nom text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT up.id,
         coalesce(nullif(btrim(up.name), ''), nullif(btrim(up.email), ''), 'Usuari')
  FROM public.user_profiles up
  WHERE public.obrador_is_management_user()
    AND p_ids IS NOT NULL
    AND up.id = ANY (p_ids);
$$;

REVOKE ALL ON FUNCTION public.obrador_noms_perfils(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.obrador_noms_perfils(uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.obrador_incidencies_exigir_accio_correctiva()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.estat = 'tancada' AND OLD.estat IS DISTINCT FROM 'tancada' THEN
    IF NEW.notes_tancament IS NULL OR char_length(btrim(NEW.notes_tancament)) < 10 THEN
      RAISE EXCEPTION 'L''acció correctiva ha de tenir almenys 10 caràcters.';
    END IF;
    IF auth.uid() IS NOT NULL THEN
      NEW.tancada_per := auth.uid();
    END IF;
    IF NEW.tancada_at IS NULL THEN
      NEW.tancada_at := now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_obrador_incidencies_accio_correctiva ON public.obrador_incidencies;
CREATE TRIGGER trg_obrador_incidencies_accio_correctiva
  BEFORE UPDATE ON public.obrador_incidencies
  FOR EACH ROW
  EXECUTE FUNCTION public.obrador_incidencies_exigir_accio_correctiva();
