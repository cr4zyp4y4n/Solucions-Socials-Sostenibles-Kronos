-- Script completo para configurar la tabla de subvenciones en Supabase
-- Ejecutar este script en Supabase SQL Editor

-- 1. Eliminar tabla existente si es necesario (CUIDADO: esto borrará todos los datos)
DROP TABLE IF EXISTS public.subvenciones CASCADE;

-- 2. Crear la tabla con todos los campos del CSV
CREATE TABLE public.subvenciones (
    -- Campos básicos
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nombre TEXT NOT NULL,
    proyecto TEXT,
    imputacion TEXT,
    
    -- Campos de identificación
    expediente TEXT,
    codigo_subvencion TEXT,
    modalidad TEXT,
    fecha_adjudicacion TEXT,
    
    -- Campos financieros
    importe_solicitado DECIMAL(15,2) DEFAULT 0,
    importe_otorgado DECIMAL(15,2) DEFAULT 0,
    periodo_ejecucion TEXT,
    
    -- Campos SOC
    soc_l1_acompanamiento DECIMAL(15,2) DEFAULT 0,
    soc_l2_contratacion DECIMAL(15,2) DEFAULT 0,
    
    -- Abonos
    primer_abono DECIMAL(15,2) DEFAULT 0,
    fecha_primer_abono TEXT,
    segundo_abono DECIMAL(15,2) DEFAULT 0,
    fecha_segundo_abono TEXT,
    
    -- Fases del proyecto (8 fases) - Boolean para fases marcadas con X, TEXT para contenido descriptivo
    fase_proyecto_1 TEXT,
    fase_proyecto_2 TEXT,
    fase_proyecto_3 TEXT,
    fase_proyecto_4 TEXT,
    fase_proyecto_5 TEXT,
    fase_proyecto_6 TEXT,
    fase_proyecto_7 TEXT,
    fase_proyecto_8 TEXT,
    
    -- Saldos y previsiones
    saldo_pendiente DECIMAL(15,2) DEFAULT 0,
    saldo_pendiente_texto TEXT,
    prevision_pago_total TEXT,
    fecha_justificacion TEXT,
    
    -- Gestión
    revisado_gestoria TEXT,
    estado TEXT,
    holded_asentamiento TEXT,
    importes_por_cobrar DECIMAL(15,2) DEFAULT 0,
    
    -- Campos de sistema
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    fecha_modificacion TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Crear índices para mejorar el rendimiento
CREATE INDEX idx_subvenciones_nombre ON public.subvenciones(nombre);
CREATE INDEX idx_subvenciones_estado ON public.subvenciones(estado);
CREATE INDEX idx_subvenciones_imputacion ON public.subvenciones(imputacion);
CREATE INDEX idx_subvenciones_expediente ON public.subvenciones(expediente);
CREATE INDEX idx_subvenciones_codigo ON public.subvenciones(codigo_subvencion);

-- 4. Habilitar RLS (Row Level Security)
ALTER TABLE public.subvenciones ENABLE ROW LEVEL SECURITY;

-- 5. Crear políticas RLS (permitir todo para usuarios autenticados)
CREATE POLICY "Usuarios autenticados pueden ver subvenciones" 
ON public.subvenciones FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Usuarios autenticados pueden insertar subvenciones" 
ON public.subvenciones FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Usuarios autenticados pueden actualizar subvenciones" 
ON public.subvenciones FOR UPDATE 
TO authenticated 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Usuarios autenticados pueden eliminar subvenciones" 
ON public.subvenciones FOR DELETE 
TO authenticated 
USING (true);

-- 6. Función para actualizar fecha_modificacion automáticamente
CREATE OR REPLACE FUNCTION update_subvenciones_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.fecha_modificacion = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 7. Trigger para actualizar fecha_modificacion
CREATE TRIGGER update_subvenciones_timestamp 
    BEFORE UPDATE ON public.subvenciones 
    FOR EACH ROW 
    EXECUTE FUNCTION update_subvenciones_updated_at();

-- 8. Comentarios para documentar la tabla
COMMENT ON TABLE public.subvenciones IS 'Tabla principal de subvenciones con todos los campos del CSV';
COMMENT ON COLUMN public.subvenciones.nombre IS 'Nombre de la subvención';
COMMENT ON COLUMN public.subvenciones.proyecto IS 'Proyecto asociado';
COMMENT ON COLUMN public.subvenciones.imputacion IS 'Imputación de la subvención (ej: EI SSS SCCL)';
COMMENT ON COLUMN public.subvenciones.estado IS 'Estado actual de la subvención (ej: VIGENTE, CERRADA)';

-- Script completado
-- Ahora puedes subir el CSV desde la aplicación para poblar la tabla
