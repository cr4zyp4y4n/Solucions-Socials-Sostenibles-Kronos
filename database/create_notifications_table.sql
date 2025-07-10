-- Script para crear la tabla notifications
-- Ejecutar este script en el SQL Editor de Supabase

-- 1. Crear la tabla notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL,
  target_roles TEXT[] DEFAULT '{}',
  recipient_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  read_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}'
);

-- 2. Crear índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON public.notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_by ON public.notifications(created_by);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON public.notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_read_at ON public.notifications(read_at);

-- 3. Habilitar RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 4. Crear políticas RLS
-- Política para SELECT (ver notificaciones propias)
CREATE POLICY "Users can view own notifications" ON public.notifications
  FOR SELECT USING (
    recipient_id = auth.uid() OR created_by = auth.uid()
  );

-- Política para INSERT (crear notificaciones)
CREATE POLICY "Users can create notifications" ON public.notifications
  FOR INSERT WITH CHECK (
    created_by = auth.uid()
  );

-- Política para UPDATE (marcar como leídas)
CREATE POLICY "Users can update own notifications" ON public.notifications
  FOR UPDATE USING (
    recipient_id = auth.uid()
  );

-- Política para DELETE (eliminar notificaciones propias)
CREATE POLICY "Users can delete own notifications" ON public.notifications
  FOR DELETE USING (
    recipient_id = auth.uid() OR created_by = auth.uid()
  );

-- 5. Función para crear notificaciones automáticamente
CREATE OR REPLACE FUNCTION public.create_notification_for_roles(
  p_title TEXT,
  p_message TEXT,
  p_type TEXT,
  p_target_roles TEXT[],
  p_created_by UUID
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.notifications (
    title,
    message,
    type,
    target_roles,
    recipient_id,
    created_by,
    created_at
  )
  SELECT 
    p_title,
    p_message,
    p_type,
    p_target_roles,
    up.id,
    p_created_by,
    NOW()
  FROM public.user_profiles up
  WHERE up.role = ANY(p_target_roles)
  AND up.id != p_created_by; -- No notificar al creador
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Verificar la estructura creada
SELECT 
  'notifications structure' as info,
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'notifications' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 7. Verificar las políticas RLS
SELECT 
  'RLS Policies' as info,
  policyname, 
  cmd, 
  qual 
FROM pg_policies 
WHERE tablename = 'notifications' 
AND schemaname = 'public'
ORDER BY policyname; 