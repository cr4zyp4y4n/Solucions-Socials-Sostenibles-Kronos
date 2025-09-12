-- Script simple para crear la tabla solucions_invoices
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

-- Crear índices básicos
CREATE INDEX IF NOT EXISTS idx_solucions_invoices_invoice_number ON public.solucions_invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_solucions_invoices_is_hidden ON public.solucions_invoices(is_hidden);
CREATE INDEX IF NOT EXISTS idx_solucions_invoices_issue_date ON public.solucions_invoices(issue_date);

-- Habilitar RLS
ALTER TABLE public.solucions_invoices ENABLE ROW LEVEL SECURITY;

-- Políticas RLS básicas
CREATE POLICY "Users can view solucions invoices" ON public.solucions_invoices
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can insert solucions invoices" ON public.solucions_invoices
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update solucions invoices" ON public.solucions_invoices
    FOR UPDATE USING (auth.role() = 'authenticated');

-- Verificar que la tabla se creó
SELECT 'Tabla solucions_invoices creada correctamente' as status;

