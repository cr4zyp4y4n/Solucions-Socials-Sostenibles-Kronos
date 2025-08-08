-- Script para crear la tabla solucions_invoices
-- Ejecutar este script en el SQL Editor de Supabase

-- Crear tabla solucions_invoices
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

-- Crear índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_solucions_invoices_invoice_number ON public.solucions_invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_solucions_invoices_is_hidden ON public.solucions_invoices(is_hidden);
CREATE INDEX IF NOT EXISTS idx_solucions_invoices_issue_date ON public.solucions_invoices(issue_date);
CREATE INDEX IF NOT EXISTS idx_solucions_invoices_provider ON public.solucions_invoices(provider);
CREATE INDEX IF NOT EXISTS idx_solucions_invoices_status ON public.solucions_invoices(status);

-- Habilitar RLS
ALTER TABLE public.solucions_invoices ENABLE ROW LEVEL SECURITY;

-- Crear políticas RLS
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

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_solucions_invoices_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar updated_at
CREATE TRIGGER update_solucions_invoices_updated_at
    BEFORE UPDATE ON public.solucions_invoices
    FOR EACH ROW
    EXECUTE FUNCTION update_solucions_invoices_updated_at();

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