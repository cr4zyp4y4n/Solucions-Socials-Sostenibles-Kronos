-- Script para modificar invoice_visibility para trabajar con identificadores de Holded
-- Ejecutar este script en el SQL Editor de Supabase

-- 1. Eliminar la restricción de clave foránea que referencia invoices
ALTER TABLE public.invoice_visibility DROP CONSTRAINT IF EXISTS invoice_visibility_invoice_id_fkey;

-- 2. Cambiar el tipo de invoice_id de UUID a TEXT
ALTER TABLE public.invoice_visibility ALTER COLUMN invoice_id TYPE TEXT;

-- 3. Verificar que el cambio se aplicó correctamente
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'invoice_visibility' 
AND table_schema = 'public'
AND column_name = 'invoice_id';

-- 4. Actualizar las funciones para trabajar con TEXT
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

-- 5. Verificar que las funciones se crearon correctamente
SELECT 
    routine_name,
    routine_type,
    data_type
FROM information_schema.routines 
WHERE routine_name IN ('is_invoice_hidden_for_role', 'get_visible_invoices_for_role')
AND routine_schema = 'public';

-- 6. Probar la función con un identificador de prueba
SELECT is_invoice_hidden_for_role('test_invoice_identifier', 'manager') as test_result; 