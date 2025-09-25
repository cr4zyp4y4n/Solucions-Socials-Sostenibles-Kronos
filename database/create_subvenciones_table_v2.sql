-- Script para crear la nueva tabla de subvenciones v2
-- Esta tabla incluye TODOS los campos del CSV sin duplicados

-- Primero eliminar la tabla existente (CUIDADO: esto borrará todos los datos)
DROP TABLE IF EXISTS public.subvenciones CASCADE;

-- Crear la nueva tabla con todos los campos
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
    fecha_adjudicacion DATE,
    
    -- Campos financieros
    importe_solicitado DECIMAL(15,2),
    importe_otorgado DECIMAL(15,2),
    periodo_ejecucion TEXT,
    
    -- Campos SOC
    soc_l1_acompanamiento DECIMAL(15,2),
    soc_l2_contratacion DECIMAL(15,2),
    
    -- Abonos
    primer_abono DECIMAL(15,2),
    fecha_primer_abono TEXT, -- Mantener como texto por formato "16/12/2022 CX 1162"
    segundo_abono DECIMAL(15,2),
    fecha_segundo_abono TEXT, -- Mantener como texto por formato "08/08 CTA 1162"
    
    -- Fases del proyecto (8 fases)
    fase_proyecto_1 TEXT,
    fase_proyecto_2 TEXT,
    fase_proyecto_3 TEXT,
    fase_proyecto_4 TEXT,
    fase_proyecto_5 TEXT,
    fase_proyecto_6 TEXT,
    fase_proyecto_7 TEXT,
    fase_proyecto_8 TEXT,
    
    -- Saldos y previsiones
    saldo_pendiente DECIMAL(15,2),
    saldo_pendiente_texto TEXT,
    prevision_pago_total TEXT,
    fecha_justificacion TEXT, -- Mantener como texto por formato complejo
    
    -- Gestión
    revisado_gestoria TEXT, -- Mantener como texto por formato "OK", "Jordi: Rechazado", etc.
    estado TEXT,
    holded_asentamiento TEXT,
    importes_por_cobrar DECIMAL(15,2),
    
    -- Campos de sistema
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    fecha_modificacion TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id)
);

-- Crear índices para mejorar el rendimiento
CREATE INDEX idx_subvenciones_nombre ON public.subvenciones(nombre);
CREATE INDEX idx_subvenciones_estado ON public.subvenciones(estado);
CREATE INDEX idx_subvenciones_imputacion ON public.subvenciones(imputacion);
CREATE INDEX idx_subvenciones_expediente ON public.subvenciones(expediente);
CREATE INDEX idx_subvenciones_codigo ON public.subvenciones(codigo_subvencion);
CREATE INDEX idx_subvenciones_fecha_adjudicacion ON public.subvenciones(fecha_adjudicacion);

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.subvenciones ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Los usuarios autenticados pueden ver todas las subvenciones" ON public.subvenciones
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Los usuarios autenticados pueden insertar subvenciones" ON public.subvenciones
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Los usuarios autenticados pueden actualizar subvenciones" ON public.subvenciones
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Los usuarios autenticados pueden eliminar subvenciones" ON public.subvenciones
    FOR DELETE USING (auth.role() = 'authenticated');

-- Función para actualizar fecha_modificacion automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para actualizar fecha_modificacion
CREATE TRIGGER update_subvenciones_updated_at 
    BEFORE UPDATE ON public.subvenciones 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comentarios para documentar los campos
COMMENT ON TABLE public.subvenciones IS 'Tabla de subvenciones con todos los campos del CSV';
COMMENT ON COLUMN public.subvenciones.nombre IS 'Nombre de la subvención';
COMMENT ON COLUMN public.subvenciones.proyecto IS 'Proyecto asociado';
COMMENT ON COLUMN public.subvenciones.imputacion IS 'Imputación contable';
COMMENT ON COLUMN public.subvenciones.expediente IS 'Número de expediente';
COMMENT ON COLUMN public.subvenciones.codigo_subvencion IS 'Código de la subvención';
COMMENT ON COLUMN public.subvenciones.modalidad IS 'Modalidad de la subvención';
COMMENT ON COLUMN public.subvenciones.fecha_adjudicacion IS 'Fecha de adjudicación';
COMMENT ON COLUMN public.subvenciones.importe_solicitado IS 'Importe solicitado';
COMMENT ON COLUMN public.subvenciones.importe_otorgado IS 'Importe otorgado';
COMMENT ON COLUMN public.subvenciones.periodo_ejecucion IS 'Período de ejecución';
COMMENT ON COLUMN public.subvenciones.soc_l1_acompanamiento IS 'SOC L1 Acompañamiento';
COMMENT ON COLUMN public.subvenciones.soc_l2_contratacion IS 'SOC L2 Contratación';
COMMENT ON COLUMN public.subvenciones.primer_abono IS 'Primer abono recibido';
COMMENT ON COLUMN public.subvenciones.fecha_primer_abono IS 'Fecha del primer abono';
COMMENT ON COLUMN public.subvenciones.segundo_abono IS 'Segundo abono recibido';
COMMENT ON COLUMN public.subvenciones.fecha_segundo_abono IS 'Fecha del segundo abono';
COMMENT ON COLUMN public.subvenciones.saldo_pendiente IS 'Saldo pendiente de abono';
COMMENT ON COLUMN public.subvenciones.saldo_pendiente_texto IS 'Texto del saldo pendiente';
COMMENT ON COLUMN public.subvenciones.prevision_pago_total IS 'Previsión de pago total';
COMMENT ON COLUMN public.subvenciones.fecha_justificacion IS 'Fecha de justificación';
COMMENT ON COLUMN public.subvenciones.revisado_gestoria IS 'Revisado por gestoría';
COMMENT ON COLUMN public.subvenciones.estado IS 'Estado de la subvención';
COMMENT ON COLUMN public.subvenciones.holded_asentamiento IS 'Asentamiento en Holded';
COMMENT ON COLUMN public.subvenciones.importes_por_cobrar IS 'Importes por cobrar';
