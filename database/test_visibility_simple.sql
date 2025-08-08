-- Script simple para probar el sistema de visibilidad
-- Ejecutar este script en el SQL Editor de Supabase

-- 1. Limpiar datos de prueba anteriores
DELETE FROM public.invoice_visibility WHERE invoice_id LIKE 'TEST_%';

-- 2. Insertar una factura de prueba oculta para manager
INSERT INTO public.invoice_visibility (
    invoice_id,
    hidden_for_role,
    reason,
    hidden_by
) VALUES (
    'TEST_INVOICE_123_TEST_PROVIDER_2025-01-01',
    'manager',
    'Prueba de visibilidad',
    (SELECT id FROM auth.users LIMIT 1)
);

-- 3. Verificar que se insertó correctamente
SELECT 
    'FACTURA DE PRUEBA INSERTADA' as tipo,
    invoice_id,
    hidden_for_role,
    reason,
    hidden_at
FROM public.invoice_visibility 
WHERE invoice_id = 'TEST_INVOICE_123_TEST_PROVIDER_2025-01-01';

-- 4. Probar la función is_invoice_hidden_for_role
SELECT 
    'PRUEBA FUNCIÓN' as tipo,
    is_invoice_hidden_for_role('TEST_INVOICE_123_TEST_PROVIDER_2025-01-01', 'manager') as esta_oculta,
    is_invoice_hidden_for_role('TEST_INVOICE_123_TEST_PROVIDER_2025-01-01', 'admin') as admin_puede_ver,
    is_invoice_hidden_for_role('FACTURA_INEXISTENTE', 'manager') as factura_inexistente;

-- 5. Verificar todas las facturas ocultas para manager
SELECT 
    'TODAS LAS FACTURAS OCULTAS PARA MANAGER' as tipo,
    COUNT(*) as total_ocultas
FROM public.invoice_visibility 
WHERE hidden_for_role = 'manager';

-- 6. Mostrar detalles de todas las ocultaciones
SELECT 
    'DETALLES DE OCULTACIONES' as tipo,
    invoice_id,
    hidden_for_role,
    reason,
    hidden_at
FROM public.invoice_visibility 
ORDER BY hidden_at DESC; 