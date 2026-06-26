-- Restringe escrituras destructivas en Obrador a roles privilegiados.
-- Ejecutar si database/create_obrador_ac3_tables.sql ya se aplicó con
-- UPDATE/DELETE abiertos para cualquier usuario authenticated.

DO $$
DECLARE
  t text;
  privileged_check text := '(auth.role() = ''authenticated'' AND (EXISTS (
        SELECT 1 FROM public.user_profiles up
        WHERE up.id = auth.uid()
          AND lower(coalesce(up.role, '''')) IN (''admin'', ''management'', ''manager'', ''jefe'', ''administrador'', ''gestion'', ''gestión'')
      ) OR lower(coalesce(auth.jwt() -> ''user_metadata'' ->> ''role'', '''')) IN (''admin'', ''management'', ''manager'', ''jefe'', ''administrador'', ''gestion'', ''gestión'')))';
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'obrador_proveidors',
    'obrador_recepcions',
    'obrador_productes',
    'obrador_operaris',
    'obrador_lots',
    'obrador_etiquetes',
    'obrador_expedicions',
    'obrador_incidencies',
    'obrador_temperatures'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);

    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_update', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR UPDATE TO authenticated USING (%s) WITH CHECK (%s)',
      t || '_update',
      t,
      privileged_check,
      privileged_check
    );

    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_delete', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR DELETE TO authenticated USING (%s)',
      t || '_delete',
      t,
      privileged_check
    );
  END LOOP;
END $$;

