-- Fichaje: que todos los usuarios y roles autenticados puedan ver y usar el módulo
-- (fichar entrada/salida, ver su historial). Sin depender de user_profiles ni del rol.

-- 1) Fichajes: reemplazar política SELECT para que cualquier autenticado pueda ver
DROP POLICY IF EXISTS "Trabajadores pueden ver sus fichajes" ON fichajes;

CREATE POLICY "Cualquier usuario autenticado puede ver fichajes"
ON fichajes
FOR SELECT
USING (auth.role() = 'authenticated');

-- INSERT y UPDATE ya permiten auth.role() = 'authenticated', no se tocan.
-- DELETE sigue restringido a admin/gestión (fix_fichajes_delete_policy.sql).

-- 2) Fichajes_pausas: que cualquier autenticado pueda ver pausas (para que el módulo funcione)
DROP POLICY IF EXISTS "Usuarios pueden ver pausas de sus fichajes" ON fichajes_pausas;

CREATE POLICY "Cualquier usuario autenticado puede ver pausas"
ON fichajes_pausas
FOR SELECT
USING (auth.role() = 'authenticated');

-- INSERT y UPDATE en fichajes_pausas ya son auth.role() = 'authenticated'.

-- 3) Fichajes_auditoría ya tiene "Usuarios autenticados pueden ver auditoría" con authenticated, OK.
