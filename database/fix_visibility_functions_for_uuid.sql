-- Script para actualizar las funciones de visibilidad para trabajar con UUIDs
-- Ejecutar este script en el SQL Editor de Supabase

-- 1. Actualizar la función is_invoice_hidden_for_role para trabajar con UUIDs
DROP FUNCTION IF EXISTS is_invoice_hidden_for_role(UUID, TEXT);
DROP FUNCTION IF EXISTS is_invoice_hidden_for_role(TEXT, TEXT);

CREATE OR REPLACE FUNCTION is_invoice_hidden_for_role(
    invoice_uuid UUID,
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
        WHERE invoice_id = invoice_uuid 
        AND hidden_for_role = user_role
    );
END;
$$;

-- 2. Actualizar la función get_visible_invoices_for_role para trabajar con UUIDs
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
        WHERE iv.invoice_id = i.id -- Ahora comparamos UUID con UUID
        AND iv.hidden_for_role = user_role
    );
END;
$$;

-- 3. Verificar que las funciones se crearon correctamente
SELECT 
    routine_name,
    routine_type,
    data_type
FROM information_schema.routines 
WHERE routine_name IN ('is_invoice_hidden_for_role', 'get_visible_invoices_for_role')
AND routine_schema = 'public';

-- 4. Probar la función is_invoice_hidden_for_role con un UUID de prueba
-- (Esto fallará si no hay datos, pero verificará que la función existe)
SELECT is_invoice_hidden_for_role('00000000-0000-0000-0000-000000000000'::UUID, 'manager') as test_result; 