-- Esquema de base de datos para SSS Kronos
-- Ejecutar este script en el SQL Editor de Supabase

-- Tabla de usuarios extendida (complementa auth.users de Supabase)
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'manager', 'admin')),
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de subidas de archivos Excel
CREATE TABLE IF NOT EXISTS public.excel_uploads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  filename TEXT NOT NULL,
  size BIGINT NOT NULL,
  type TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  uploaded_by UUID REFERENCES auth.users(id),
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMP WITH TIME ZONE
);

-- Tabla de facturas/proveedores
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  upload_id UUID REFERENCES public.excel_uploads(id) ON DELETE CASCADE,
  invoice_number TEXT,
  internal_number TEXT,
  issue_date DATE,
  accounting_date DATE,
  due_date DATE,
  provider TEXT NOT NULL,
  description TEXT,
  tags TEXT,
  account TEXT,
  project TEXT,
  subtotal DECIMAL(15,2),
  vat DECIMAL(15,2),
  retention DECIMAL(15,2),
  employees DECIMAL(15,2),
  equipment_recovery DECIMAL(15,2),
  total DECIMAL(15,2),
  paid BOOLEAN DEFAULT FALSE,
  pending DECIMAL(15,2),
  status TEXT,
  payment_date DATE,
  processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Tabla de proveedores
CREATE TABLE IF NOT EXISTS public.providers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de análisis/estadísticas
CREATE TABLE IF NOT EXISTS public.analytics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  total_invoices INTEGER DEFAULT 0,
  total_amount DECIMAL(15,2) DEFAULT 0,
  paid_amount DECIMAL(15,2) DEFAULT 0,
  pending_amount DECIMAL(15,2) DEFAULT 0,
  top_providers JSONB DEFAULT '[]',
  monthly_totals JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_invoices_provider ON public.invoices(provider);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON public.invoices(issue_date);
CREATE INDEX IF NOT EXISTS idx_invoices_upload ON public.invoices(upload_id);
CREATE INDEX IF NOT EXISTS idx_excel_uploads_user ON public.excel_uploads(uploaded_by);

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para updated_at
CREATE TRIGGER update_user_profiles_updated_at 
  BEFORE UPDATE ON public.user_profiles 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_providers_updated_at 
  BEFORE UPDATE ON public.providers 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_analytics_updated_at 
  BEFORE UPDATE ON public.analytics 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Políticas RLS (Row Level Security) - CORREGIDAS

-- Habilitar RLS en todas las tablas
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.excel_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics ENABLE ROW LEVEL SECURITY;

-- Políticas para user_profiles (CORREGIDAS)
CREATE POLICY "Users can view own profile" ON public.user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.user_profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Políticas para excel_uploads
CREATE POLICY "Users can view own uploads" ON public.excel_uploads
  FOR SELECT USING (auth.uid() = uploaded_by);

CREATE POLICY "Users can insert own uploads" ON public.excel_uploads
  FOR INSERT WITH CHECK (auth.uid() = uploaded_by);

-- Políticas para invoices
CREATE POLICY "Users can view invoices from own uploads" ON public.invoices
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.excel_uploads 
      WHERE id = upload_id AND uploaded_by = auth.uid()
    )
  );

CREATE POLICY "Users can insert invoices for own uploads" ON public.invoices
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.excel_uploads 
      WHERE id = upload_id AND uploaded_by = auth.uid()
    )
  );

-- Políticas para providers
CREATE POLICY "All authenticated users can view providers" ON public.providers
  FOR SELECT USING (auth.role() = 'authenticated');

-- Políticas para analytics
CREATE POLICY "All authenticated users can view analytics" ON public.analytics
  FOR SELECT USING (auth.role() = 'authenticated');

-- Función para crear perfil de usuario automáticamente
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, name, role, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'user'),
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para crear perfil automáticamente
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user(); 