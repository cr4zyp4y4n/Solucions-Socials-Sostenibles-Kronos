-- =====================================================
-- HOJAS TÉCNICAS - Database Schema
-- =====================================================
-- This script creates the necessary tables and policies
-- for managing technical sheets (hojas técnicas) for dishes
-- =====================================================

-- Create storage bucket for dish images
INSERT INTO storage.buckets (id, name, public)
VALUES ('dish-images', 'dish-images', true)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on storage bucket
CREATE POLICY "Public read access for dish images"
ON storage.objects FOR SELECT
USING (bucket_id = 'dish-images');

CREATE POLICY "Authenticated users can upload dish images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'dish-images' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can update dish images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'dish-images' AND auth.role() = 'authenticated')
WITH CHECK (bucket_id = 'dish-images' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete dish images"
ON storage.objects FOR DELETE
USING (bucket_id = 'dish-images' AND auth.role() = 'authenticated');

-- =====================================================
-- Main Table: hojas_tecnicas
-- =====================================================
CREATE TABLE IF NOT EXISTS public.hojas_tecnicas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre_plato TEXT NOT NULL,
  imagen_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  CONSTRAINT nombre_plato_not_empty CHECK (LENGTH(TRIM(nombre_plato)) > 0)
);

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_hojas_tecnicas_created_at ON public.hojas_tecnicas(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hojas_tecnicas_nombre ON public.hojas_tecnicas(nombre_plato);

-- =====================================================
-- Table: hoja_tecnica_ingredientes
-- =====================================================
CREATE TABLE IF NOT EXISTS public.hoja_tecnica_ingredientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hoja_tecnica_id UUID NOT NULL REFERENCES public.hojas_tecnicas(id) ON DELETE CASCADE,
  nombre_ingrediente TEXT NOT NULL,
  peso_gramos DECIMAL(10, 2) NOT NULL DEFAULT 0,
  coste_euros DECIMAL(10, 2) NOT NULL DEFAULT 0,
  gastos_euros DECIMAL(10, 2) NOT NULL DEFAULT 0,
  orden INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT nombre_ingrediente_not_empty CHECK (LENGTH(TRIM(nombre_ingrediente)) > 0),
  CONSTRAINT peso_gramos_positive CHECK (peso_gramos >= 0),
  CONSTRAINT coste_euros_positive CHECK (coste_euros >= 0),
  CONSTRAINT gastos_euros_positive CHECK (gastos_euros >= 0)
);

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_ingredientes_hoja_tecnica ON public.hoja_tecnica_ingredientes(hoja_tecnica_id);
CREATE INDEX IF NOT EXISTS idx_ingredientes_orden ON public.hoja_tecnica_ingredientes(hoja_tecnica_id, orden);

-- =====================================================
-- Table: hoja_tecnica_alergenos
-- =====================================================
CREATE TABLE IF NOT EXISTS public.hoja_tecnica_alergenos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hoja_tecnica_id UUID NOT NULL REFERENCES public.hojas_tecnicas(id) ON DELETE CASCADE,
  tipo_alergeno TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT tipo_alergeno_not_empty CHECK (LENGTH(TRIM(tipo_alergeno)) > 0),
  CONSTRAINT unique_alergeno_per_hoja UNIQUE (hoja_tecnica_id, tipo_alergeno)
);

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_alergenos_hoja_tecnica ON public.hoja_tecnica_alergenos(hoja_tecnica_id);

-- =====================================================
-- Trigger: Update updated_at timestamp
-- =====================================================
CREATE OR REPLACE FUNCTION update_hojas_tecnicas_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_hojas_tecnicas_timestamp
BEFORE UPDATE ON public.hojas_tecnicas
FOR EACH ROW
EXECUTE FUNCTION update_hojas_tecnicas_updated_at();

-- =====================================================
-- RLS Policies
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE public.hojas_tecnicas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hoja_tecnica_ingredientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hoja_tecnica_alergenos ENABLE ROW LEVEL SECURITY;

-- Policies for hojas_tecnicas
CREATE POLICY "Users can view all hojas tecnicas"
ON public.hojas_tecnicas FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can create hojas tecnicas"
ON public.hojas_tecnicas FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update hojas tecnicas"
ON public.hojas_tecnicas FOR UPDATE
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete hojas tecnicas"
ON public.hojas_tecnicas FOR DELETE
USING (auth.role() = 'authenticated');

-- Policies for hoja_tecnica_ingredientes
CREATE POLICY "Users can view all ingredientes"
ON public.hoja_tecnica_ingredientes FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can create ingredientes"
ON public.hoja_tecnica_ingredientes FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update ingredientes"
ON public.hoja_tecnica_ingredientes FOR UPDATE
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete ingredientes"
ON public.hoja_tecnica_ingredientes FOR DELETE
USING (auth.role() = 'authenticated');

-- Policies for hoja_tecnica_alergenos
CREATE POLICY "Users can view all alergenos"
ON public.hoja_tecnica_alergenos FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can create alergenos"
ON public.hoja_tecnica_alergenos FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update alergenos"
ON public.hoja_tecnica_alergenos FOR UPDATE
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete alergenos"
ON public.hoja_tecnica_alergenos FOR DELETE
USING (auth.role() = 'authenticated');

-- =====================================================
-- Helper Function: Get complete hoja tecnica with details
-- =====================================================
CREATE OR REPLACE FUNCTION get_hoja_tecnica_completa(hoja_id UUID)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'hoja_tecnica', row_to_json(ht.*),
    'ingredientes', COALESCE(
      (SELECT json_agg(row_to_json(ing.*) ORDER BY ing.orden)
       FROM hoja_tecnica_ingredientes ing
       WHERE ing.hoja_tecnica_id = hoja_id),
      '[]'::json
    ),
    'alergenos', COALESCE(
      (SELECT json_agg(row_to_json(alg.*))
       FROM hoja_tecnica_alergenos alg
       WHERE alg.hoja_tecnica_id = hoja_id),
      '[]'::json
    ),
    'resumen_costes', json_build_object(
      'total_peso', COALESCE((SELECT SUM(peso_gramos) FROM hoja_tecnica_ingredientes WHERE hoja_tecnica_id = hoja_id), 0),
      'total_coste', COALESCE((SELECT SUM(coste_euros) FROM hoja_tecnica_ingredientes WHERE hoja_tecnica_id = hoja_id), 0),
      'total_gastos', COALESCE((SELECT SUM(gastos_euros) FROM hoja_tecnica_ingredientes WHERE hoja_tecnica_id = hoja_id), 0),
      'coste_total', COALESCE((SELECT SUM(coste_euros + gastos_euros) FROM hoja_tecnica_ingredientes WHERE hoja_tecnica_id = hoja_id), 0)
    )
  ) INTO result
  FROM hojas_tecnicas ht
  WHERE ht.id = hoja_id;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_hoja_tecnica_completa(UUID) TO authenticated;

-- =====================================================
-- Success Message
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '✅ Hojas Técnicas schema created successfully!';
  RAISE NOTICE '📋 Tables created: hojas_tecnicas, hoja_tecnica_ingredientes, hoja_tecnica_alergenos';
  RAISE NOTICE '🖼️  Storage bucket created: dish-images';
  RAISE NOTICE '🔒 RLS policies enabled for all tables';
END $$;
