-- =============================================================================
-- Qui signa cada registre d'higiene: número de fitxatge
-- El portal envia el número. El disparador busca el nom a fichajes_codigos
-- i el copia al registre. No es torna a calcular si el número no canvia.
-- Executar després de alter_obrador_neteja_periodes.sql
-- =============================================================================

ALTER TABLE public.obrador_registres_torn
  ADD COLUMN IF NOT EXISTS codi_fichatge TEXT,
  ADD COLUMN IF NOT EXISTS nom_operari TEXT;

COMMENT ON COLUMN public.obrador_registres_torn.codi_fichatge IS
  'Número de fitxatge escrit en signar. El disparador el comprova contra fichajes_codigos.';
COMMENT ON COLUMN public.obrador_registres_torn.nom_operari IS
  'Nom de la persona en el moment de signar, copiat de fichajes_codigos.descripcion.';

CREATE OR REPLACE FUNCTION public.obrador_nom_per_codi_fichatge(p_codi text)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nom text;
BEGIN
  IF NULLIF(btrim(coalesce(p_codi, '')), '') IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT btrim(descripcion)
    INTO v_nom
  FROM public.fichajes_codigos
  WHERE btrim(codigo) = btrim(p_codi)
    AND coalesce(activo, false) = true
  LIMIT 1;

  IF v_nom IS NULL OR v_nom = '' THEN
    RETURN NULL;
  END IF;
  RETURN v_nom;
END;
$$;

COMMENT ON FUNCTION public.obrador_nom_per_codi_fichatge(text) IS
  'Retorna només el nom d''un codi de fitxatge actiu. No llista el personal.';

REVOKE ALL ON FUNCTION public.obrador_nom_per_codi_fichatge(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.obrador_nom_per_codi_fichatge(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.obrador_registres_torn_abans_desar()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_item jsonb;
  v_tipus public.obrador_tipus_registre%ROWTYPE;
  v_n integer;
  v_fets integer;
BEGIN
  IF NEW.tipus_codi IS NULL THEN
    NEW.tipus_codi := CASE NEW.moment
      WHEN 'inici' THEN 'torn_inici'
      WHEN 'produccio' THEN 'torn_produccio'
      WHEN 'tancament' THEN 'torn_tancament'
      ELSE NULL
    END;
  END IF;

  IF NEW.tipus_codi IS NULL THEN
    RAISE EXCEPTION 'Cal un tipus de registre.';
  END IF;

  SELECT * INTO v_tipus
  FROM public.obrador_tipus_registre
  WHERE codi = NEW.tipus_codi;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tipus de registre desconegut: %', NEW.tipus_codi;
  END IF;

  IF NOT coalesce(v_tipus.actiu, false) THEN
    RAISE EXCEPTION 'Aquest tipus de registre està desactivat.';
  END IF;

  NEW.moment := CASE NEW.tipus_codi
    WHEN 'torn_inici' THEN 'inici'
    WHEN 'torn_produccio' THEN 'produccio'
    WHEN 'torn_tancament' THEN 'tancament'
    ELSE NULL
  END;

  IF NEW.data IS NULL THEN
    NEW.data := CURRENT_DATE;
  END IF;

  NEW.periode_inici := CASE v_tipus.frequencia
    WHEN 'mensual' THEN date_trunc('month', NEW.data)::date
    WHEN 'trimestral' THEN date_trunc('quarter', NEW.data)::date
    WHEN 'setmanal' THEN date_trunc('week', NEW.data)::date
    ELSE NEW.data
  END;

  IF NEW.items IS NULL OR jsonb_typeof(NEW.items) <> 'array' THEN
    NEW.items := '[]'::jsonb;
  END IF;

  v_n := jsonb_array_length(NEW.items);

  IF v_tipus.es_checklist AND v_n = 0 THEN
    RAISE EXCEPTION 'El registre ha de tenir els ítems del checklist.';
  END IF;

  IF NOT v_tipus.es_checklist AND v_n = 0 AND (NEW.detall IS NULL OR NEW.detall = 'null'::jsonb) THEN
    RAISE EXCEPTION 'Aquest registre ha de tenir el detall de la fitxa.';
  END IF;

  IF v_n > 0 THEN
    FOR v_item IN SELECT value FROM jsonb_array_elements(NEW.items)
    LOOP
      IF coalesce(v_item->>'clau', '') = '' OR coalesce(v_item->>'etiqueta', '') = '' THEN
        RAISE EXCEPTION 'Cada ítem ha de tenir clau i etiqueta.';
      END IF;
      IF (v_item->>'ok') IS NULL OR (v_item->>'ok') NOT IN ('true', 'false') THEN
        RAISE EXCEPTION 'Cada ítem ha de respondre sí o no.';
      END IF;
    END LOOP;

    NEW.incidencia_detectada := EXISTS (
      SELECT 1
      FROM jsonb_array_elements(NEW.items) AS el(value)
      WHERE el.value->>'ok' = 'false'
    );
  END IF;

  IF v_tipus.unic_per_periode AND EXISTS (
    SELECT 1
    FROM public.obrador_registres_torn
    WHERE tipus_codi = NEW.tipus_codi
      AND periode_inici = NEW.periode_inici
      AND id IS DISTINCT FROM NEW.id
  ) THEN
    RAISE EXCEPTION 'Ja hi ha un registre d''aquest tipus per aquest període.';
  END IF;

  IF v_tipus.maxim_per_periode IS NOT NULL THEN
    SELECT count(*) INTO v_fets
    FROM public.obrador_registres_torn
    WHERE tipus_codi = NEW.tipus_codi
      AND periode_inici = NEW.periode_inici
      AND id IS DISTINCT FROM NEW.id;
    IF v_fets >= v_tipus.maxim_per_periode THEN
      RAISE EXCEPTION 'Aquest període ja té el màxim de registres (%).', v_tipus.maxim_per_periode;
    END IF;
  END IF;

  NEW.codi_fichatge := NULLIF(btrim(coalesce(NEW.codi_fichatge, '')), '');
  IF TG_OP = 'UPDATE' AND NEW.codi_fichatge IS NOT DISTINCT FROM OLD.codi_fichatge THEN
    NEW.nom_operari := OLD.nom_operari;
  ELSE
    IF NEW.codi_fichatge IS NULL THEN
      RAISE EXCEPTION 'Cal el número de fitxatge.';
    END IF;
    NEW.nom_operari := public.obrador_nom_per_codi_fichatge(NEW.codi_fichatge);
    IF NEW.nom_operari IS NULL THEN
      RAISE EXCEPTION 'Aquest número de fitxatge no correspon a ningú.';
    END IF;
  END IF;

  IF auth.uid() IS NOT NULL THEN
    NEW.registrat_per := auth.uid();
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.obrador_registres_torn_limitar_portal()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF public.obrador_is_management_user() THEN
    RETURN NEW;
  END IF;

  IF NOT public.obrador_is_portal_staff_user() THEN
    RAISE EXCEPTION 'Sense permís per modificar el registre.';
  END IF;

  IF NEW.data IS DISTINCT FROM OLD.data
    OR NEW.tipus_codi IS DISTINCT FROM OLD.tipus_codi
    OR NEW.items IS DISTINCT FROM OLD.items
    OR NEW.detall IS DISTINCT FROM OLD.detall
    OR coalesce(NEW.observacions, '') IS DISTINCT FROM coalesce(OLD.observacions, '')
    OR NEW.id_operari IS DISTINCT FROM OLD.id_operari
    OR NEW.codi_fichatge IS DISTINCT FROM OLD.codi_fichatge
    OR NEW.nom_operari IS DISTINCT FROM OLD.nom_operari
    OR NEW.origen_extern IS DISTINCT FROM OLD.origen_extern
    OR NEW.document_adjunt_path IS DISTINCT FROM OLD.document_adjunt_path
  THEN
    RAISE EXCEPTION 'Des del portal només es pot lligar la incidència al registre ja signat.';
  END IF;

  RETURN NEW;
END;
$$;
