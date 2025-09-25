-- Crear tabla de subvenciones
CREATE TABLE IF NOT EXISTS public.subvenciones (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nombre TEXT NOT NULL,
    organismo TEXT,
    importe_otorgado DECIMAL(15,2),
    periodo_ejecucion TEXT,
    primer_abono DECIMAL(15,2),
    saldo_pendiente DECIMAL(15,2),
    saldo_pendiente_texto TEXT,
    estado TEXT,
    imputacion TEXT,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    fecha_modificacion TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id)
);

-- Crear tabla de comentarios de subvenciones
CREATE TABLE IF NOT EXISTS public.subvenciones_comentarios (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    subvencion_id UUID REFERENCES public.subvenciones(id) ON DELETE CASCADE,
    comentario TEXT NOT NULL,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id)
);

-- Crear tabla de fases del proyecto
CREATE TABLE IF NOT EXISTS public.subvenciones_fases (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    subvencion_id UUID REFERENCES public.subvenciones(id) ON DELETE CASCADE,
    fase_numero INTEGER NOT NULL,
    fase_nombre TEXT,
    fase_contenido TEXT,
    fase_activa BOOLEAN DEFAULT FALSE,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- Crear índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_subvenciones_nombre ON public.subvenciones(nombre);
CREATE INDEX IF NOT EXISTS idx_subvenciones_estado ON public.subvenciones(estado);
CREATE INDEX IF NOT EXISTS idx_subvenciones_imputacion ON public.subvenciones(imputacion);
CREATE INDEX IF NOT EXISTS idx_subvenciones_created_by ON public.subvenciones(created_by);

CREATE INDEX IF NOT EXISTS idx_subvenciones_comentarios_subvencion_id ON public.subvenciones_comentarios(subvencion_id);
CREATE INDEX IF NOT EXISTS idx_subvenciones_comentarios_created_by ON public.subvenciones_comentarios(created_by);

CREATE INDEX IF NOT EXISTS idx_subvenciones_fases_subvencion_id ON public.subvenciones_fases(subvencion_id);
CREATE INDEX IF NOT EXISTS idx_subvenciones_fases_numero ON public.subvenciones_fases(fase_numero);

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.subvenciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subvenciones_comentarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subvenciones_fases ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para subvenciones
CREATE POLICY "Los usuarios autenticados pueden ver todas las subvenciones" ON public.subvenciones
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Los usuarios autenticados pueden insertar subvenciones" ON public.subvenciones
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Los usuarios autenticados pueden actualizar subvenciones" ON public.subvenciones
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Los usuarios autenticados pueden eliminar subvenciones" ON public.subvenciones
    FOR DELETE USING (auth.role() = 'authenticated');

-- Políticas RLS para comentarios
CREATE POLICY "Los usuarios autenticados pueden ver todos los comentarios" ON public.subvenciones_comentarios
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Los usuarios autenticados pueden insertar comentarios" ON public.subvenciones_comentarios
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Los usuarios autenticados pueden actualizar comentarios" ON public.subvenciones_comentarios
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Los usuarios autenticados pueden eliminar comentarios" ON public.subvenciones_comentarios
    FOR DELETE USING (auth.role() = 'authenticated');

-- Políticas RLS para fases
CREATE POLICY "Los usuarios autenticados pueden ver todas las fases" ON public.subvenciones_fases
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Los usuarios autenticados pueden insertar fases" ON public.subvenciones_fases
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Los usuarios autenticados pueden actualizar fases" ON public.subvenciones_fases
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Los usuarios autenticados pueden eliminar fases" ON public.subvenciones_fases
    FOR DELETE USING (auth.role() = 'authenticated');

-- Función para actualizar fecha_modificacion automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para actualizar fecha_modificacion en subvenciones
CREATE TRIGGER update_subvenciones_updated_at 
    BEFORE UPDATE ON public.subvenciones 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger para actualizar fecha_modificacion en comentarios
CREATE TRIGGER update_subvenciones_comentarios_updated_at 
    BEFORE UPDATE ON public.subvenciones_comentarios 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
