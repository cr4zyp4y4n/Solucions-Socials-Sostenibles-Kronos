-- Script para corregir el esquema de la tabla excel_uploads
-- Ejecutar este script en el SQL Editor de Supabase

-- 1. Verificar si la tabla existe y su estructura actual
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'excel_uploads' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Agregar campos faltantes si no existen
ALTER TABLE public.excel_uploads 
ADD COLUMN IF NOT EXISTS file_path TEXT,
ADD COLUMN IF NOT EXISTS upload_type TEXT,
ADD COLUMN IF NOT EXISTS data_count INTEGER;

-- 3. Actualizar la estructura para que coincida con el esquema esperado
-- Si la tabla no tiene los campos correctos, la recreamos

-- Primero, hacer backup de los datos existentes
CREATE TEMP TABLE excel_uploads_backup AS 
SELECT * FROM public.excel_uploads;

-- Eliminar la tabla actual
DROP TABLE IF EXISTS public.excel_uploads CASCADE;

-- Crear la tabla con la estructura correcta
CREATE TABLE public.excel_uploads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  filename TEXT NOT NULL,
  size BIGINT NOT NULL,
  type TEXT NOT NULL,
  file_path TEXT,
  upload_type TEXT,
  data_count INTEGER,
  metadata JSONB DEFAULT '{}',
  uploaded_by UUID REFERENCES auth.users(id),
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMP WITH TIME ZONE
);

-- Restaurar los datos del backup
INSERT INTO public.excel_uploads (
  id, filename, size, type, file_path, upload_type, data_count, 
  metadata, uploaded_by, uploaded_at, processed, processed_at
)
SELECT 
  id, 
  filename, 
  COALESCE(size, 0) as size,
  COALESCE(type, upload_type, 'unknown') as type,
  file_path,
  upload_type,
  data_count,
  metadata,
  uploaded_by,
  uploaded_at,
  processed,
  processed_at
FROM excel_uploads_backup;

-- 4. Crear índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_excel_uploads_user ON public.excel_uploads(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_excel_uploads_type ON public.excel_uploads(type);
CREATE INDEX IF NOT EXISTS idx_excel_uploads_date ON public.excel_uploads(uploaded_at);

-- 5. Habilitar RLS
ALTER TABLE public.excel_uploads ENABLE ROW LEVEL SECURITY;

-- 6. Crear políticas RLS
DROP POLICY IF EXISTS "Users can view own uploads" ON public.excel_uploads;
DROP POLICY IF EXISTS "Users can insert own uploads" ON public.excel_uploads;

CREATE POLICY "Users can view own uploads" ON public.excel_uploads
  FOR SELECT USING (auth.uid() = uploaded_by);

CREATE POLICY "Users can insert own uploads" ON public.excel_uploads
  FOR INSERT WITH CHECK (auth.uid() = uploaded_by);

-- 7. Verificar la estructura final
SELECT 
  'excel_uploads' as table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'excel_uploads' 
AND table_schema = 'public'
ORDER BY ordinal_position; 