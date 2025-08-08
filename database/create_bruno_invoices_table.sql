-- Crear tabla para las facturas que ve Bruno
-- Ejecutar este script en el SQL Editor de Supabase

-- 1. Crear la tabla bruno_invoices
CREATE TABLE IF NOT EXISTS public.bruno_invoices (
    id SERIAL PRIMARY KEY,
    invoice_number TEXT UNIQUE NOT NULL,
    provider TEXT,
    issue_date DATE,
    due_date DATE,
    total DECIMAL(15,2),
    subtotal DECIMAL(15,2),
    vat DECIMAL(15,2),
    status TEXT,
    description TEXT,
    tags TEXT,
    account TEXT,
    project TEXT,
    retention DECIMAL(15,2),
    employees DECIMAL(15,2),
    equipment_recovery DECIMAL(15,2),
    pending DECIMAL(15,2),
    payment_date DATE,
    -- Campos de control de visibilidad
    is_hidden BOOLEAN DEFAULT FALSE,
    hidden_reason TEXT,
    hidden_by UUID REFERENCES auth.users(id),
    hidden_at TIMESTAMP WITH TIME ZONE,
    -- Campos de auditoría
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Campos de Holded para referencia
    holded_id TEXT,
    holded_contact_id TEXT,
    document_type TEXT
);

-- 2. Crear índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_bruno_invoices_invoice_number ON public.bruno_invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_bruno_invoices_is_hidden ON public.bruno_invoices(is_hidden);
CREATE INDEX IF NOT EXISTS idx_bruno_invoices_provider ON public.bruno_invoices(provider);
CREATE INDEX IF NOT EXISTS idx_bruno_invoices_issue_date ON public.bruno_invoices(issue_date);

-- 3. Habilitar RLS (Row Level Security)
ALTER TABLE public.bruno_invoices ENABLE ROW LEVEL SECURITY;

-- 4. Crear políticas RLS
-- Todos pueden ver facturas no ocultas
CREATE POLICY "Users can view visible invoices" ON public.bruno_invoices
    FOR SELECT USING (is_hidden = FALSE);

-- Solo management y admin pueden ver todas las facturas
CREATE POLICY "Management can view all invoices" ON public.bruno_invoices
    FOR SELECT USING (
        auth.jwt() ->> 'role' IN ('management', 'admin')
    );

-- Solo management y admin pueden insertar/actualizar
CREATE POLICY "Management can insert invoices" ON public.bruno_invoices
    FOR INSERT WITH CHECK (
        auth.jwt() ->> 'role' IN ('management', 'admin')
    );

CREATE POLICY "Management can update invoices" ON public.bruno_invoices
    FOR UPDATE USING (
        auth.jwt() ->> 'role' IN ('management', 'admin')
    );

-- 5. Crear función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_bruno_invoices_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Crear trigger para actualizar updated_at
CREATE TRIGGER trigger_bruno_invoices_updated_at
    BEFORE UPDATE ON public.bruno_invoices
    FOR EACH ROW
    EXECUTE FUNCTION update_bruno_invoices_updated_at();

-- 7. Verificar que la tabla se creó correctamente
SELECT 
    'TABLA CREADA' as tipo,
    table_name,
    table_type
FROM information_schema.tables 
WHERE table_name = 'bruno_invoices' 
AND table_schema = 'public';

-- 8. Verificar las políticas RLS
SELECT 
    'POLÍTICAS RLS' as tipo,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies 
WHERE tablename = 'bruno_invoices'; 