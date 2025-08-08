-- Script para corregir las políticas RLS de las tablas de productos de IDONI
-- Este script debe ejecutarse si ya existen las tablas pero hay problemas de permisos

-- Eliminar políticas existentes que puedan estar causando conflictos
DROP POLICY IF EXISTS "Administradores pueden hacer todo en idoni_ventas_productos_importe" ON idoni_ventas_productos_importe;
DROP POLICY IF EXISTS "Administradores pueden hacer todo en idoni_ventas_productos_cantidad" ON idoni_ventas_productos_cantidad;
DROP POLICY IF EXISTS "Managers pueden leer idoni_ventas_productos_importe" ON idoni_ventas_productos_importe;
DROP POLICY IF EXISTS "Managers pueden leer idoni_ventas_productos_cantidad" ON idoni_ventas_productos_cantidad;
DROP POLICY IF EXISTS "Usuarios pueden leer idoni_ventas_productos_importe" ON idoni_ventas_productos_importe;
DROP POLICY IF EXISTS "Usuarios pueden leer idoni_ventas_productos_cantidad" ON idoni_ventas_productos_cantidad;
DROP POLICY IF EXISTS "Permitir todo para usuarios autenticados en idoni_ventas_productos_importe" ON idoni_ventas_productos_importe;
DROP POLICY IF EXISTS "Permitir todo para usuarios autenticados en idoni_ventas_productos_cantidad" ON idoni_ventas_productos_cantidad;

-- Crear políticas simplificadas que permitan acceso completo
CREATE POLICY "Permitir todo para usuarios autenticados en idoni_ventas_productos_importe" ON idoni_ventas_productos_importe
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Permitir todo para usuarios autenticados en idoni_ventas_productos_cantidad" ON idoni_ventas_productos_cantidad
    FOR ALL USING (auth.role() = 'authenticated');

-- Verificar que las políticas se han creado correctamente
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename IN ('idoni_ventas_productos_importe', 'idoni_ventas_productos_cantidad');
