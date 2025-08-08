-- Script para migrar la tabla invoice_visibility de UUID a TEXT
-- Ejecutar este script en el SQL Editor de Supabase

-- 1. Verificar la estructura actual de la tabla
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'invoice_visibility' 
AND table_schema = 'public'
AND column_name = 'invoice_id';

-- 2. Si la tabla existe con invoice_id como UUID, alterarla
DO $$
BEGIN
    -- Verificar si la columna invoice_id es de tipo UUID
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'invoice_visibility' 
        AND table_schema = 'public'
        AND column_name = 'invoice_id'
        AND data_type = 'uuid'
    ) THEN
        -- Eliminar la restricción UNIQUE si existe
        ALTER TABLE public.invoice_visibility DROP CONSTRAINT IF EXISTS invoice_visibility_invoice_id_hidden_for_role_key;
        
        -- Cambiar el tipo de dato de UUID a TEXT
        ALTER TABLE public.invoice_visibility ALTER COLUMN invoice_id TYPE TEXT;
        
        -- Recrear la restricción UNIQUE
        ALTER TABLE public.invoice_visibility ADD CONSTRAINT invoice_visibility_invoice_id_hidden_for_role_key 
        UNIQUE(invoice_id, hidden_for_role);
        
        RAISE NOTICE 'Tabla invoice_visibility migrada exitosamente de UUID a TEXT';
    ELSE
        RAISE NOTICE 'La tabla invoice_visibility ya tiene invoice_id como TEXT o no existe';
    END IF;
END $$;

-- 3. Verificar el resultado de la migración
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'invoice_visibility' 
AND table_schema = 'public'
AND column_name = 'invoice_id';

-- 4. Verificar que las funciones estén actualizadas
SELECT 
    routine_name,
    routine_type
FROM information_schema.routines 
WHERE routine_name IN ('is_invoice_hidden_for_role', 'get_visible_invoices_for_role')
AND routine_schema = 'public'; 