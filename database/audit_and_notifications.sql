-- Esquema para auditoría y notificaciones
-- Ejecutar este script en el SQL Editor de Supabase

-- Tabla de auditoría
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de notificaciones
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  recipient_id UUID REFERENCES auth.users(id) NOT NULL,
  sender_id UUID REFERENCES auth.users(id),
  type TEXT NOT NULL CHECK (type IN ('user_updated', 'user_deleted', 'role_changed', 'system')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_id ON public.notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read_at ON public.notifications(read_at);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at);

-- Habilitar RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Políticas para audit_logs (solo admins pueden ver)
CREATE POLICY "Admins can view all audit logs" ON public.audit_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "System can insert audit logs" ON public.audit_logs
  FOR INSERT WITH CHECK (true);

-- Políticas para notifications
CREATE POLICY "Users can view own notifications" ON public.notifications
  FOR SELECT USING (recipient_id = auth.uid());

CREATE POLICY "Users can update own notifications" ON public.notifications
  FOR UPDATE USING (recipient_id = auth.uid());

CREATE POLICY "System can insert notifications" ON public.notifications
  FOR INSERT WITH CHECK (true);

-- Función para crear notificaciones
CREATE OR REPLACE FUNCTION public.create_notification(
  p_recipient_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_data JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
  notification_id UUID;
BEGIN
  INSERT INTO public.notifications (
    recipient_id,
    type,
    title,
    message,
    data
  ) VALUES (
    p_recipient_id,
    p_type,
    p_title,
    p_message,
    p_data
  ) RETURNING id INTO notification_id;
  
  RETURN notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para registrar auditoría
CREATE OR REPLACE FUNCTION public.log_audit(
  p_action TEXT,
  p_table_name TEXT,
  p_record_id UUID DEFAULT NULL,
  p_old_values JSONB DEFAULT NULL,
  p_new_values JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  audit_id UUID;
BEGIN
  INSERT INTO public.audit_logs (
    user_id,
    action,
    table_name,
    record_id,
    old_values,
    new_values
  ) VALUES (
    auth.uid(),
    p_action,
    p_table_name,
    p_record_id,
    p_old_values,
    p_new_values
  ) RETURNING id INTO audit_id;
  
  RETURN audit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para auditar cambios en user_profiles
CREATE OR REPLACE FUNCTION public.audit_user_profile_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    PERFORM public.log_audit(
      'UPDATE',
      'user_profiles',
      NEW.id,
      to_jsonb(OLD),
      to_jsonb(NEW)
    );
    
    -- Crear notificación para el usuario afectado
    IF OLD.role != NEW.role THEN
      PERFORM public.create_notification(
        NEW.id,
        'role_changed',
        'Tu rol ha sido actualizado',
        'Tu rol ha cambiado de ' || OLD.role || ' a ' || NEW.role,
        jsonb_build_object('old_role', OLD.role, 'new_role', NEW.role)
      );
    END IF;
    
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.log_audit(
      'DELETE',
      'user_profiles',
      OLD.id,
      to_jsonb(OLD),
      NULL
    );
    
  ELSIF TG_OP = 'INSERT' THEN
    PERFORM public.log_audit(
      'INSERT',
      'user_profiles',
      NEW.id,
      NULL,
      to_jsonb(NEW)
    );
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crear trigger para auditar cambios
CREATE TRIGGER audit_user_profiles_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.audit_user_profile_changes(); 