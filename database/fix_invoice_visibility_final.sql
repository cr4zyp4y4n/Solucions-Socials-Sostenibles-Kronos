-- Script para verificar y corregir la estructura de invoice_visibility
-- Ejecutar este script en el SQL Editor de Supabase

-- 1. Verificar la estructura actual de la tabla
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'invoice_visibility' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Verificar las restricciones actuales
SELECT 
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
LEFT JOIN information_schema.constraint_column_usage ccu 
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'invoice_visibility' 
AND tc.table_schema = 'public';

-- 3. Corregir la estructura si es necesario
DO $$
BEGIN
    -- Verificar si invoice_id es UUID y cambiarlo a TEXT
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'invoice_visibility' 
        AND table_schema = 'public'
        AND column_name = 'invoice_id'
        AND data_type = 'uuid'
    ) THEN
        RAISE NOTICE 'Cambiando invoice_id de UUID a TEXT...';
        
        -- Eliminar la restricción UNIQUE si existe
        ALTER TABLE public.invoice_visibility DROP CONSTRAINT IF EXISTS invoice_visibility_invoice_id_hidden_for_role_key;
        
        -- Eliminar la clave foránea si existe
        ALTER TABLE public.invoice_visibility DROP CONSTRAINT IF EXISTS invoice_visibility_invoice_id_fkey;
        
        -- Cambiar el tipo de dato de UUID a TEXT
        ALTER TABLE public.invoice_visibility ALTER COLUMN invoice_id TYPE TEXT;
        
        -- Recrear la restricción UNIQUE
        ALTER TABLE public.invoice_visibility ADD CONSTRAINT invoice_visibility_invoice_id_hidden_for_role_key 
        UNIQUE(invoice_id, hidden_for_role);
        
        RAISE NOTICE 'invoice_id cambiado exitosamente a TEXT';
    ELSE
        RAISE NOTICE 'invoice_id ya es TEXT o no existe';
    END IF;
END $$;

-- 4. Verificar que las funciones estén actualizadas
DROP FUNCTION IF EXISTS is_invoice_hidden_for_role(UUID, TEXT);
DROP FUNCTION IF EXISTS is_invoice_hidden_for_role(TEXT, TEXT);

CREATE OR REPLACE FUNCTION is_invoice_hidden_for_role(
    invoice_identifier TEXT,
    user_role TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM public.invoice_visibility 
        WHERE invoice_id = invoice_identifier 
        AND hidden_for_role = user_role
    );
END;
$$;

-- 5. Actualizar la función get_visible_invoices_for_role
DROP FUNCTION IF EXISTS get_visible_invoices_for_role(TEXT);

CREATE OR REPLACE FUNCTION get_visible_invoices_for_role(user_role TEXT)
RETURNS TABLE (
    id UUID,
    upload_id UUID,
    invoice_number TEXT,
    internal_number TEXT,
    issue_date DATE,
    accounting_date DATE,
    due_date DATE,
    provider TEXT,
    description TEXT,
    tags TEXT,
    account TEXT,
    project TEXT,
    subtotal DECIMAL(15,2),
    vat DECIMAL(15,2),
    retention DECIMAL(15,2),
    employees DECIMAL(15,2),
    equipment_recovery DECIMAL(15,2),
    total DECIMAL(15,2),
    paid BOOLEAN,
    pending DECIMAL(15,2),
    status TEXT,
    payment_date DATE,
    processed_at TIMESTAMP WITH TIME ZONE,
    created_by UUID,
    holded_id TEXT,
    holded_contact_id TEXT,
    document_type TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT i.*
    FROM public.invoices i
    WHERE NOT EXISTS (
        SELECT 1 
        FROM public.invoice_visibility iv 
        WHERE iv.invoice_id = i.id::text -- Cast UUID to text for comparison
        AND iv.hidden_for_role = user_role
    );
END;
$$;

-- 6. Verificar el resultado final
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'invoice_visibility' 
AND table_schema = 'public'
AND column_name = 'invoice_id';

-- 7. Probar las funciones
SELECT is_invoice_hidden_for_role('test_invoice_identifier', 'manager') as test_result;

-- 8. Verificar que las funciones se crearon correctamente
SELECT 
    routine_name,
    routine_type,
    data_type
FROM information_schema.routines 
WHERE routine_name IN ('is_invoice_hidden_for_role', 'get_visible_invoices_for_role')
AND routine_schema = 'public'; 