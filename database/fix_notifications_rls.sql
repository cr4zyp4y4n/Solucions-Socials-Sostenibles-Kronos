-- Script para configurar las políticas RLS de la tabla notifications existente
-- Ejecutar este script en el SQL Editor de Supabase

-- 1. Verificar la estructura actual de notifications
SELECT 
  'Current notifications structure' as info,
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'notifications' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Verificar las políticas RLS actuales
SELECT 
  'Current RLS Policies' as info,
  schemaname, 
  tablename, 
  policyname, 
  permissive, 
  roles, 
  cmd, 
  qual 
FROM pg_policies 
WHERE tablename = 'notifications' 
AND schemaname = 'public'
ORDER BY policyname;

-- 3. Eliminar políticas existentes si las hay
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can create notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;

-- 4. Habilitar RLS si no está habilitado
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 5. Crear políticas RLS para notifications
-- Política para SELECT (ver notificaciones propias)
CREATE POLICY "Users can view own notifications" ON public.notifications
  FOR SELECT USING (
    recipient_id = auth.uid() OR sender_id = auth.uid()
  );

-- Política para INSERT (crear notificaciones)
CREATE POLICY "Users can create notifications" ON public.notifications
  FOR INSERT WITH CHECK (
    sender_id = auth.uid()
  );

-- Política para UPDATE (marcar como leídas)
CREATE POLICY "Users can update own notifications" ON public.notifications
  FOR UPDATE USING (
    recipient_id = auth.uid()
  );

-- Política para DELETE (eliminar notificaciones propias)
CREATE POLICY "Users can delete own notifications" ON public.notifications
  FOR DELETE USING (
    recipient_id = auth.uid() OR sender_id = auth.uid()
  );

-- 6. Verificar las políticas creadas
SELECT 
  'Final RLS Policies' as info,
  policyname, 
  cmd, 
  qual 
FROM pg_policies 
WHERE tablename = 'notifications' 
AND schemaname = 'public'
ORDER BY policyname;

-- 7. Verificar que RLS está habilitado
SELECT 
  'RLS Status' as info,
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables 
WHERE tablename = 'notifications' 
AND schemaname = 'public'; 