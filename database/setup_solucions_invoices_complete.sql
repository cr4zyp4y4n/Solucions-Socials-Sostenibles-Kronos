-- Script completo para configurar la tabla solucions_invoices
-- Ejecutar este script en el SQL Editor de Supabase

-- =====================================================
-- 1. CREAR TABLA solucions_invoices
-- =====================================================

CREATE TABLE IF NOT EXISTS public.solucions_invoices (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    invoice_number TEXT UNIQUE NOT NULL,
    provider TEXT,
    issue_date TIMESTAMP WITH TIME ZONE,
    due_date TIMESTAMP WITH TIME ZONE,
    total DECIMAL(15,2),
    subtotal DECIMAL(15,2),
    vat DECIMAL(15,2),
    status TEXT,
    description TEXT,
    tags TEXT[],
    account TEXT,
    project TEXT,
    retention DECIMAL(15,2),
    employees TEXT[],
    equipment_recovery DECIMAL(15,2),
    pending DECIMAL(15,2),
    payment_date TIMESTAMP WITH TIME ZONE,
    holded_id TEXT,
    holded_contact_id TEXT,
    document_type TEXT,
    is_hidden BOOLEAN DEFAULT false,
    hidden_reason TEXT,
    hidden_by UUID REFERENCES auth.users(id),
    hidden_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- =====================================================
-- 2. CREAR ÍNDICES PARA MEJOR RENDIMIENTO
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_solucions_invoices_invoice_number ON public.solucions_invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_solucions_invoices_is_hidden ON public.solucions_invoices(is_hidden);
CREATE INDEX IF NOT EXISTS idx_solucions_invoices_issue_date ON public.solucions_invoices(issue_date);
CREATE INDEX IF NOT EXISTS idx_solucions_invoices_provider ON public.solucions_invoices(provider);
CREATE INDEX IF NOT EXISTS idx_solucions_invoices_status ON public.solucions_invoices(status);

-- =====================================================
-- 3. HABILITAR ROW LEVEL SECURITY (RLS)
-- =====================================================

ALTER TABLE public.solucions_invoices ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 4. CREAR POLÍTICAS RLS
-- =====================================================

-- Política para SELECT (todos los usuarios autenticados pueden ver)
CREATE POLICY "Users can view solucions invoices" ON public.solucions_invoices
    FOR SELECT USING (
        auth.role() = 'authenticated'
    );

-- Política para INSERT (usuarios autenticados pueden insertar)
CREATE POLICY "Authenticated users can insert solucions invoices" ON public.solucions_invoices
    FOR INSERT WITH CHECK (
        auth.role() = 'authenticated'
    );

-- Política para UPDATE (usuarios autenticados pueden actualizar)
CREATE POLICY "Authenticated users can update solucions invoices" ON public.solucions_invoices
    FOR UPDATE USING (
        auth.role() = 'authenticated'
    );

-- =====================================================
-- 5. FUNCIÓN PARA ACTUALIZAR updated_at AUTOMÁTICAMENTE
-- =====================================================

CREATE OR REPLACE FUNCTION update_solucions_invoices_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 6. TRIGGER PARA ACTUALIZAR updated_at
-- =====================================================

CREATE TRIGGER update_solucions_invoices_updated_at
    BEFORE UPDATE ON public.solucions_invoices
    FOR EACH ROW
    EXECUTE FUNCTION update_solucions_invoices_updated_at();

-- =====================================================
-- 7. VERIFICACIONES Y PRUEBAS
-- =====================================================

-- Verificar que la tabla se creó correctamente
SELECT 
    'TABLA CREADA' as status,
    COUNT(*) as total_filas
FROM public.solucions_invoices;

-- Verificar políticas RLS
SELECT
    'POLÍTICAS RLS' as tipo,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies
WHERE tablename = 'solucions_invoices'
ORDER BY policyname;

-- Verificar índices
SELECT
    'ÍNDICES' as tipo,
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'solucions_invoices'
ORDER BY indexname;

-- =====================================================
-- 8. PRUEBA DE INSERCIÓN
-- =====================================================

-- Insertar una factura de prueba
INSERT INTO public.solucions_invoices (
    invoice_number,
    provider,
    issue_date,
    total,
    status,
    description,
    is_hidden
) VALUES (
    'TEST_SOLUCIONS_001',
    'Proveedor de Prueba Solucions',
    '2025-01-01',
    1500.00,
    'paid',
    'Factura de prueba para Solucions Socials',
    false
) ON CONFLICT (invoice_number) DO NOTHING;

-- Verificar inserción
SELECT
    'PRUEBA DE INSERCIÓN' as tipo,
    invoice_number,
    provider,
    total,
    status,
    is_hidden
FROM public.solucions_invoices
WHERE invoice_number = 'TEST_SOLUCIONS_001';

-- =====================================================
-- 9. LIMPIEZA DE DATOS DE PRUEBA
-- =====================================================

-- Limpiar datos de prueba
DELETE FROM public.solucions_invoices WHERE invoice_number = 'TEST_SOLUCIONS_001';

-- Verificar limpieza
SELECT
    'LIMPIEZA COMPLETADA' as tipo,
    COUNT(*) as total_facturas
FROM public.solucions_invoices
WHERE invoice_number = 'TEST_SOLUCIONS_001';

-- =====================================================
-- 10. RESUMEN FINAL
-- =====================================================

SELECT
    'RESUMEN FINAL' as tipo,
    'Tabla solucions_invoices configurada correctamente' as mensaje,
    COUNT(*) as total_facturas_existentes
FROM public.solucions_invoices; 