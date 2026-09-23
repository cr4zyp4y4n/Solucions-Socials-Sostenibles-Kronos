-- =============================================================================
-- Habilitar Supabase Realtime per al dashboard IoT Obrador
-- Executar a SQL Editor DESPRÉS de create_obrador_sensors_iot.sql
-- =============================================================================

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.obrador_temperatures;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.obrador_sensors;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.obrador_incidencies;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- Verificar:
-- SELECT schemaname, tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime'
--   AND tablename LIKE 'obrador_%';
