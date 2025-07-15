-- Script final para corregir la estructura de invoices de manera segura
-- Ejecutar este script en el SQL Editor de Supabase

-- ========================================
-- 1. VERIFICAR ESTRUCTURA ACTUAL
-- ========================================

SELECT 'Verificando estructura actual de invoices...' as status;

SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default,
  character_maximum_length
FROM information_schema.columns 
WHERE table_name = 'invoices' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- ========================================
-- 2. VERIFICAR TIPOS DE FECHAS ACTUALES
-- ========================================

SELECT 'Verificando tipos de fechas actuales...' as status;

SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'invoices' 
AND table_schema = 'public'
AND column_name IN ('issue_date', 'accounting_date', 'due_date', 'payment_date', 'processed_at')
ORDER BY column_name;

-- ========================================
-- 3. CORREGIR FECHAS DE MANERA SEGURA
-- ========================================

SELECT 'Corrigiendo fechas de manera segura...' as status;

-- Para cada columna de fecha, verificar el tipo y convertir apropiadamente
-- issue_date
DO $$
BEGIN
    -- Verificar si la columna existe y su tipo
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'invoices' 
        AND column_name = 'issue_date' 
        AND table_schema = 'public'
    ) THEN
        -- Si es DATE, convertir a TIMESTAMP WITH TIME ZONE
        IF (SELECT data_type FROM information_schema.columns 
            WHERE table_name = 'invoices' 
            AND column_name = 'issue_date' 
            AND table_schema = 'public') = 'date' THEN
            
            ALTER TABLE public.invoices 
            ALTER COLUMN issue_date TYPE TIMESTAMP WITH TIME ZONE USING issue_date::timestamp with time zone;
            
        -- Si es TIMESTAMP, asegurar que sea WITH TIME ZONE
        ELSIF (SELECT data_type FROM information_schema.columns 
               WHERE table_name = 'invoices' 
               AND column_name = 'issue_date' 
               AND table_schema = 'public') LIKE 'timestamp%' THEN
            
            ALTER TABLE public.invoices 
            ALTER COLUMN issue_date TYPE TIMESTAMP WITH TIME ZONE USING issue_date::timestamp with time zone;
        END IF;
    END IF;
END $$;

-- accounting_date
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'invoices' 
        AND column_name = 'accounting_date' 
        AND table_schema = 'public'
    ) THEN
        IF (SELECT data_type FROM information_schema.columns 
            WHERE table_name = 'invoices' 
            AND column_name = 'accounting_date' 
            AND table_schema = 'public') = 'date' THEN
            
            ALTER TABLE public.invoices 
            ALTER COLUMN accounting_date TYPE TIMESTAMP WITH TIME ZONE USING accounting_date::timestamp with time zone;
            
        ELSIF (SELECT data_type FROM information_schema.columns 
               WHERE table_name = 'invoices' 
               AND column_name = 'accounting_date' 
               AND table_schema = 'public') LIKE 'timestamp%' THEN
            
            ALTER TABLE public.invoices 
            ALTER COLUMN accounting_date TYPE TIMESTAMP WITH TIME ZONE USING accounting_date::timestamp with time zone;
        END IF;
    END IF;
END $$;

-- due_date
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'invoices' 
        AND column_name = 'due_date' 
        AND table_schema = 'public'
    ) THEN
        IF (SELECT data_type FROM information_schema.columns 
            WHERE table_name = 'invoices' 
            AND column_name = 'due_date' 
            AND table_schema = 'public') = 'date' THEN
            
            ALTER TABLE public.invoices 
            ALTER COLUMN due_date TYPE TIMESTAMP WITH TIME ZONE USING due_date::timestamp with time zone;
            
        ELSIF (SELECT data_type FROM information_schema.columns 
               WHERE table_name = 'invoices' 
               AND column_name = 'due_date' 
               AND table_schema = 'public') LIKE 'timestamp%' THEN
            
            ALTER TABLE public.invoices 
            ALTER COLUMN due_date TYPE TIMESTAMP WITH TIME ZONE USING due_date::timestamp with time zone;
        END IF;
    END IF;
END $$;

-- payment_date
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'invoices' 
        AND column_name = 'payment_date' 
        AND table_schema = 'public'
    ) THEN
        IF (SELECT data_type FROM information_schema.columns 
            WHERE table_name = 'invoices' 
            AND column_name = 'payment_date' 
            AND table_schema = 'public') = 'date' THEN
            
            ALTER TABLE public.invoices 
            ALTER COLUMN payment_date TYPE TIMESTAMP WITH TIME ZONE USING payment_date::timestamp with time zone;
            
        ELSIF (SELECT data_type FROM information_schema.columns 
               WHERE table_name = 'invoices' 
               AND column_name = 'payment_date' 
               AND table_schema = 'public') LIKE 'timestamp%' THEN
            
            ALTER TABLE public.invoices 
            ALTER COLUMN payment_date TYPE TIMESTAMP WITH TIME ZONE USING payment_date::timestamp with time zone;
        END IF;
    END IF;
END $$;

-- processed_at
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'invoices' 
        AND column_name = 'processed_at' 
        AND table_schema = 'public'
    ) THEN
        IF (SELECT data_type FROM information_schema.columns 
            WHERE table_name = 'invoices' 
            AND column_name = 'processed_at' 
            AND table_schema = 'public') = 'date' THEN
            
            ALTER TABLE public.invoices 
            ALTER COLUMN processed_at TYPE TIMESTAMP WITH TIME ZONE USING processed_at::timestamp with time zone;
            
        ELSIF (SELECT data_type FROM information_schema.columns 
               WHERE table_name = 'invoices' 
               AND column_name = 'processed_at' 
               AND table_schema = 'public') LIKE 'timestamp%' THEN
            
            ALTER TABLE public.invoices 
            ALTER COLUMN processed_at TYPE TIMESTAMP WITH TIME ZONE USING processed_at::timestamp with time zone;
        END IF;
    END IF;
END $$;

-- ========================================
-- 4. CORREGIR TIPOS DE DATOS NUMÉRICOS
-- ========================================

SELECT 'Corrigiendo tipos de datos numéricos...' as status;

-- Asegurar que los campos numéricos sean del tipo correcto
ALTER TABLE public.invoices 
ALTER COLUMN subtotal TYPE NUMERIC(15,2) USING 
  CASE 
    WHEN subtotal IS NULL THEN 0
    ELSE COALESCE(subtotal::numeric, 0)
  END;

ALTER TABLE public.invoices 
ALTER COLUMN vat TYPE NUMERIC(15,2) USING 
  CASE 
    WHEN vat IS NULL THEN 0
    ELSE COALESCE(vat::numeric, 0)
  END;

ALTER TABLE public.invoices 
ALTER COLUMN retention TYPE NUMERIC(15,2) USING 
  CASE 
    WHEN retention IS NULL THEN 0
    ELSE COALESCE(retention::numeric, 0)
  END;

ALTER TABLE public.invoices 
ALTER COLUMN total TYPE NUMERIC(15,2) USING 
  CASE 
    WHEN total IS NULL THEN 0
    ELSE COALESCE(total::numeric, 0)
  END;

ALTER TABLE public.invoices 
ALTER COLUMN pending TYPE NUMERIC(15,2) USING 
  CASE 
    WHEN pending IS NULL THEN 0
    ELSE COALESCE(pending::numeric, 0)
  END;

-- ========================================
-- 5. CORREGIR TIPOS DE DATOS DE TEXTO
-- ========================================

SELECT 'Corrigiendo tipos de datos de texto...' as status;

-- Asegurar que los campos de texto sean del tipo correcto
ALTER TABLE public.invoices 
ALTER COLUMN invoice_number TYPE TEXT USING COALESCE(invoice_number::text, '');

ALTER TABLE public.invoices 
ALTER COLUMN internal_number TYPE TEXT USING COALESCE(internal_number::text, '');

ALTER TABLE public.invoices 
ALTER COLUMN provider TYPE TEXT USING COALESCE(provider::text, '');

ALTER TABLE public.invoices 
ALTER COLUMN description TYPE TEXT USING COALESCE(description::text, '');

ALTER TABLE public.invoices 
ALTER COLUMN tags TYPE TEXT USING COALESCE(tags::text, '');

ALTER TABLE public.invoices 
ALTER COLUMN account TYPE TEXT USING COALESCE(account::text, '');

ALTER TABLE public.invoices 
ALTER COLUMN project TYPE TEXT USING COALESCE(project::text, '');

ALTER TABLE public.invoices 
ALTER COLUMN status TYPE TEXT USING COALESCE(status::text, '');

ALTER TABLE public.invoices 
ALTER COLUMN holded_id TYPE TEXT USING COALESCE(holded_id::text, '');

ALTER TABLE public.invoices 
ALTER COLUMN holded_contact_id TYPE TEXT USING COALESCE(holded_contact_id::text, '');

ALTER TABLE public.invoices 
ALTER COLUMN document_type TYPE TEXT USING COALESCE(document_type::text, 'invoice');

-- ========================================
-- 6. CORREGIR CAMPOS ESPECÍFICOS
-- ========================================

SELECT 'Corrigiendo campos específicos...' as status;

-- Verificar si employees es numérico y convertirlo a texto si es necesario
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'invoices' 
        AND column_name = 'employees' 
        AND table_schema = 'public'
        AND data_type = 'numeric'
    ) THEN
        ALTER TABLE public.invoices 
        ALTER COLUMN employees TYPE TEXT USING COALESCE(employees::text, '');
    END IF;
END $$;

-- Verificar si equipment_recovery es numérico y convertirlo a texto si es necesario
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'invoices' 
        AND column_name = 'equipment_recovery' 
        AND table_schema = 'public'
        AND data_type = 'numeric'
    ) THEN
        ALTER TABLE public.invoices 
        ALTER COLUMN equipment_recovery TYPE TEXT USING COALESCE(equipment_recovery::text, '');
    END IF;
END $$;

-- ========================================
-- 7. CORREGIR TIPOS DE DATOS BOOLEANOS
-- ========================================

SELECT 'Corrigiendo tipos de datos booleanos...' as status;

-- Asegurar que el campo paid sea boolean
ALTER TABLE public.invoices 
ALTER COLUMN paid TYPE BOOLEAN USING 
  CASE 
    WHEN paid IS NULL THEN FALSE
    WHEN paid::text IN ('true', '1', 't', 'yes') THEN TRUE
    ELSE FALSE
  END;

-- ========================================
-- 8. VERIFICACIÓN FINAL
-- ========================================

SELECT 'Verificando estructura final...' as status;

SELECT 
  'invoices' as table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'invoices' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- ========================================
-- 9. PROBAR INSERCIÓN DE DATOS DE PRUEBA
-- ========================================

SELECT 'Probando inserción de datos de prueba...' as status;

-- Insertar un registro de prueba para verificar que la estructura funciona
INSERT INTO public.invoices (
  invoice_number,
  internal_number,
  issue_date,
  accounting_date,
  due_date,
  provider,
  description,
  tags,
  account,
  project,
  subtotal,
  vat,
  retention,
  employees,
  equipment_recovery,
  total,
  paid,
  pending,
  status,
  payment_date,
  holded_id,
  holded_contact_id,
  document_type,
  upload_id,
  processed_at
) VALUES (
  'TEST-001',
  'INT-001',
  NOW(),
  NOW(),
  NOW() + INTERVAL '30 days',
  'Proveedor de Prueba',
  'Descripción de prueba',
  'test, holded',
  'Cuenta de prueba',
  'Proyecto de prueba',
  1000.00,
  210.00,
  0.00,
  'Empleados de prueba',
  'Equipamiento de prueba',
  1000.00,
  FALSE,
  1000.00,
  'pending',
  NULL,
  'holded_test_001',
  'contact_test_001',
  'invoice',
  gen_random_uuid(),
  NOW()
);

-- Verificar que se insertó correctamente
SELECT 
  invoice_number,
  provider,
  total,
  paid,
  holded_id,
  document_type,
  employees,
  equipment_recovery
FROM public.invoices 
WHERE invoice_number = 'TEST-001';

-- Limpiar datos de prueba
DELETE FROM public.invoices WHERE invoice_number = 'TEST-001';

SELECT '¡Script completado exitosamente!' as status; 