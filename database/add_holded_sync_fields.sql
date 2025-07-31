-- Script simplificado para agregar campos necesarios para la sincronización con Holded
-- Ejecutar este script en el SQL Editor de Supabase

-- Agregar campo para tipo de upload (Excel vs API)
ALTER TABLE public.excel_uploads 
ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'excel';

-- Agregar campos para referencias de Holded
ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS holded_id TEXT,
ADD COLUMN IF NOT EXISTS holded_contact_id TEXT;

-- Crear índices para mejorar rendimiento de búsquedas
CREATE INDEX IF NOT EXISTS idx_invoices_holded_id ON public.invoices(holded_id);
CREATE INDEX IF NOT EXISTS idx_invoices_holded_contact_id ON public.invoices(holded_contact_id);
CREATE INDEX IF NOT EXISTS idx_excel_uploads_type ON public.excel_uploads(type);

-- Comentarios para documentar los cambios
COMMENT ON COLUMN public.excel_uploads.type IS 'Tipo de upload: excel o holded_api';
COMMENT ON COLUMN public.invoices.holded_id IS 'ID original del documento en Holded';
COMMENT ON COLUMN public.invoices.holded_contact_id IS 'ID del contacto en Holded'; 