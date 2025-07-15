-- Script para verificar y corregir la restricción de clave foránea
-- Ejecutar este script en el SQL Editor de Supabase

-- ========================================
-- 1. VERIFICAR RESTRICCIONES ACTUALES
-- ========================================

SELECT 'Verificando restricciones de clave foránea actuales...' as status;

SELECT 
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name,
  rc.delete_rule,
  rc.update_rule
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.referential_constraints AS rc
  ON tc.constraint_name = rc.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
AND tc.table_name = 'invoices'
ORDER BY tc.constraint_name;

-- ========================================
-- 2. VERIFICAR SI EXISTE LA RESTRICCIÓN
-- ========================================

SELECT 'Verificando si existe la restricción invoices_upload_id_fkey...' as status;

SELECT 
  constraint_name,
  table_name,
  column_name
FROM information_schema.key_column_usage 
WHERE constraint_name = 'invoices_upload_id_fkey'
AND table_schema = 'public';

-- ========================================
-- 3. ELIMINAR RESTRICCIÓN SI EXISTE
-- ========================================

SELECT 'Eliminando restricción de clave foránea si existe...' as status;

ALTER TABLE public.invoices 
DROP CONSTRAINT IF EXISTS invoices_upload_id_fkey;

-- ========================================
-- 4. VERIFICAR QUE LA COLUMNA UPLOAD_ID EXISTE
-- ========================================

SELECT 'Verificando que la columna upload_id existe...' as status;

SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'invoices' 
AND table_schema = 'public'
AND column_name = 'upload_id';

-- ========================================
-- 5. AGREGAR LA COLUMNA UPLOAD_ID SI NO EXISTE
-- ========================================

SELECT 'Agregando columna upload_id si no existe...' as status;

ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS upload_id UUID;

-- ========================================
-- 6. CREAR RESTRICCIÓN DE CLAVE FORÁNEA CORRECTA
-- ========================================

SELECT 'Creando restricción de clave foránea correcta...' as status;

-- Crear la restricción con CASCADE para permitir eliminación automática
ALTER TABLE public.invoices 
ADD CONSTRAINT invoices_upload_id_fkey 
FOREIGN KEY (upload_id) 
REFERENCES public.excel_uploads(id) 
ON DELETE CASCADE 
ON UPDATE CASCADE;

-- ========================================
-- 7. VERIFICAR QUE LA RESTRICCIÓN SE CREÓ CORRECTAMENTE
-- ========================================

SELECT 'Verificando que la restricción se creó correctamente...' as status;

SELECT 
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name,
  rc.delete_rule,
  rc.update_rule
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.referential_constraints AS rc
  ON tc.constraint_name = rc.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
AND tc.table_name = 'invoices'
ORDER BY tc.constraint_name;

-- ========================================
-- 8. PROBAR LA RESTRICCIÓN CON DATOS DE PRUEBA
-- ========================================

SELECT 'Probando la restricción con datos de prueba...' as status;

-- Crear un registro de prueba en excel_uploads
INSERT INTO public.excel_uploads (
  filename,
  size,
  type,
  uploaded_by,
  metadata,
  processed,
  processed_at
) VALUES (
  'test_foreign_key',
  0,
  'test',
  auth.uid(),
  '{"test": true}',
  true,
  NOW()
) ON CONFLICT DO NOTHING;

-- Obtener el ID del registro de prueba
DO $$
DECLARE
  test_upload_id UUID;
BEGIN
  SELECT id INTO test_upload_id 
  FROM public.excel_uploads 
  WHERE filename = 'test_foreign_key' 
  LIMIT 1;
  
  IF test_upload_id IS NOT NULL THEN
    -- Intentar insertar un registro en invoices con el upload_id válido
    INSERT INTO public.invoices (
      invoice_number,
      provider,
      total,
      upload_id
    ) VALUES (
      'TEST-FK-001',
      'Proveedor Test FK',
      100.00,
      test_upload_id
    );
    
    -- Verificar que se insertó correctamente
    RAISE NOTICE 'Prueba exitosa: registro insertado con upload_id %', test_upload_id;
    
    -- Limpiar datos de prueba
    DELETE FROM public.invoices WHERE invoice_number = 'TEST-FK-001';
    DELETE FROM public.excel_uploads WHERE filename = 'test_foreign_key';
    
  ELSE
    RAISE NOTICE 'No se pudo crear registro de prueba en excel_uploads';
  END IF;
END $$;

SELECT '¡Script completado exitosamente!' as status; 