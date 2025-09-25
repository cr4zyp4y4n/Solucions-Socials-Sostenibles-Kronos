-- Script para eliminar todas las tablas de subvenciones existentes
-- EJECUTAR EN SUPABASE

-- Eliminar tablas relacionadas con subvenciones
DROP TABLE IF EXISTS public.subvenciones_comentarios CASCADE;
DROP TABLE IF EXISTS public.subvenciones_fases CASCADE;
DROP TABLE IF EXISTS public.subvenciones CASCADE;
DROP TABLE IF EXISTS public.subvenciones_backup CASCADE;
DROP TABLE IF EXISTS public.subvenciones_v2 CASCADE;

-- Verificar que se eliminaron
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE '%subvencion%';
