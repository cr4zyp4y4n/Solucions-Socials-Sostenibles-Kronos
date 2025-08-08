-- Script de prueba para el sistema de visibilidad de facturas
-- Ejecutar este script en el SQL Editor de Supabase para verificar el funcionamiento

-- 1. Verificar que la tabla existe
SELECT 
  'Tabla invoice_visibility' as test,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'invoice_visibility') 
    THEN '✅ EXISTE' 
    ELSE '❌ NO EXISTE' 
  END as resultado;

-- 2. Verificar que las funciones existen
SELECT 
  'Función is_invoice_hidden_for_role' as test,
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_invoice_hidden_for_role') 
    THEN '✅ EXISTE' 
    ELSE '❌ NO EXISTE' 
  END as resultado;

SELECT 
  'Función get_visible_invoices_for_role' as test,
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_visible_invoices_for_role') 
    THEN '✅ EXISTE' 
    ELSE '❌ NO EXISTE' 
  END as resultado;

-- 3. Verificar políticas RLS
SELECT 
  'Políticas RLS para invoice_visibility' as test,
  COUNT(*) as total_policies
FROM pg_policies 
WHERE tablename = 'invoice_visibility';

-- 4. Verificar que hay facturas en la base de datos
SELECT 
  'Facturas disponibles' as test,
  COUNT(*) as total_invoices
FROM public.invoices;

-- 5. Verificar roles de usuarios
SELECT 
  'Roles de usuarios' as test,
  role,
  COUNT(*) as user_count
FROM public.user_profiles 
GROUP BY role 
ORDER BY role;

-- 6. Probar función de visibilidad (debería devolver todas las facturas si no hay ocultaciones)
SELECT 
  'Prueba función get_visible_invoices_for_role para manager' as test,
  COUNT(*) as visible_invoices
FROM get_visible_invoices_for_role('manager');

-- 7. Insertar una prueba de ocultación (solo si hay facturas disponibles)
DO $$
DECLARE
  test_invoice_id UUID;
  test_user_id UUID;
BEGIN
  -- Obtener una factura de prueba
  SELECT id INTO test_invoice_id FROM public.invoices LIMIT 1;
  
  -- Obtener un usuario de management o admin
  SELECT id INTO test_user_id FROM public.user_profiles 
  WHERE role IN ('management', 'admin') 
  LIMIT 1;
  
  -- Solo insertar si tenemos datos válidos
  IF test_invoice_id IS NOT NULL AND test_user_id IS NOT NULL THEN
    -- Insertar ocultación de prueba
    INSERT INTO public.invoice_visibility (
      invoice_id, 
      hidden_for_role, 
      hidden_by, 
      reason
    ) VALUES (
      test_invoice_id,
      'manager',
      test_user_id,
      'Prueba del sistema de visibilidad'
    ) ON CONFLICT (invoice_id, hidden_for_role) DO NOTHING;
    
    RAISE NOTICE '✅ Prueba de ocultación insertada correctamente';
  ELSE
    RAISE NOTICE '⚠️ No se pudo insertar prueba - faltan datos';
  END IF;
END $$;

-- 8. Verificar que la ocultación se insertó
SELECT 
  'Ocultaciones creadas' as test,
  COUNT(*) as total_hidden
FROM public.invoice_visibility;

-- 9. Probar función de visibilidad después de la ocultación
SELECT 
  'Prueba función después de ocultación' as test,
  COUNT(*) as visible_invoices_after_hide
FROM get_visible_invoices_for_role('manager');

-- 10. Mostrar detalles de la ocultación de prueba
SELECT 
  'Detalles de ocultación de prueba' as test,
  iv.invoice_id,
  iv.hidden_for_role,
  iv.reason,
  iv.hidden_at,
  up.name as hidden_by_user
FROM public.invoice_visibility iv
LEFT JOIN public.user_profiles up ON iv.hidden_by = up.id
WHERE iv.reason = 'Prueba del sistema de visibilidad';

-- 11. Limpiar prueba (opcional - comentar si quieres mantener la prueba)
-- DELETE FROM public.invoice_visibility WHERE reason = 'Prueba del sistema de visibilidad';

-- 12. Resumen final
SELECT 
  'RESUMEN DEL SISTEMA' as test,
  'Estado del sistema de visibilidad de facturas' as descripcion,
  NOW() as fecha_verificacion; 