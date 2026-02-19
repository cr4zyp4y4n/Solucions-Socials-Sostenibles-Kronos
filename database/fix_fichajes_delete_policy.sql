-- Permitir a admin/gestión/jefes eliminar fichajes (para corregir datos erróneos)
-- Sin esta política, RLS bloquea cualquier DELETE y en el dashboard "no hace nada".

-- 1) Añadir política DELETE para roles admin/gestión (desde la app o API con usuario admin)
CREATE POLICY "Admin y gestión pueden eliminar fichajes"
ON fichajes
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM user_profiles up
    WHERE up.id = auth.uid()
    AND up.role IN ('admin', 'management', 'manager', 'jefe', 'administrador', 'gestión', 'gestion')
  )
);

-- 2) Para borrar desde el SQL Editor (por ejemplo fichajes con horas erróneas):
--    Ejecuta en Supabase > SQL Editor (se ejecuta como postgres y no aplica RLS):
--
--    DELETE FROM fichajes WHERE horas_trabajadas > 100;
--    -- o por id concreto:
--    DELETE FROM fichajes WHERE id = 'uuid-del-fichaje';
--
--    Las tablas fichajes_pausas y fichajes_auditoria tienen ON DELETE CASCADE,
--    así que se borran solas al eliminar el fichaje.
