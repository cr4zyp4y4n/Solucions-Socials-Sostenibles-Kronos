-- =====================================================
-- Script de verificación de tablas de fichajes
-- Ejecutar después de create_fichajes_tables.sql
-- =====================================================

-- Verificar que las tablas existen
SELECT 
    table_name,
    table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('fichajes', 'fichajes_pausas', 'fichajes_auditoria')
ORDER BY table_name;

-- Verificar índices
SELECT 
    indexname,
    tablename
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('fichajes', 'fichajes_pausas', 'fichajes_auditoria')
ORDER BY tablename, indexname;

-- Verificar funciones
SELECT 
    routine_name,
    routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'update_fichajes_updated_at',
    'calcular_horas_trabajadas',
    'registrar_auditoria_fichaje',
    'calcular_duracion_pausa',
    'get_fichajes_empleado',
    'get_resumen_mensual_fichajes'
  )
ORDER BY routine_name;

-- Verificar triggers
SELECT 
    trigger_name,
    event_object_table,
    action_timing,
    event_manipulation
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table IN ('fichajes', 'fichajes_pausas')
ORDER BY event_object_table, trigger_name;

-- Verificar políticas RLS
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('fichajes', 'fichajes_pausas', 'fichajes_auditoria')
ORDER BY tablename, policyname;

-- Verificar que RLS está habilitado
SELECT 
    tablename,
    rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('fichajes', 'fichajes_pausas', 'fichajes_auditoria')
ORDER BY tablename;




