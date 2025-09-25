-- Script para actualizar la tabla de subvenciones con todos los campos del modal de edición
-- Ejecutar este script en Supabase para añadir los campos faltantes

-- Añadir campos faltantes a la tabla subvenciones
ALTER TABLE public.subvenciones 
ADD COLUMN IF NOT EXISTS expediente TEXT,
ADD COLUMN IF NOT EXISTS codigo TEXT,
ADD COLUMN IF NOT EXISTS modalidad TEXT,
ADD COLUMN IF NOT EXISTS fecha_adjudicacion DATE,
ADD COLUMN IF NOT EXISTS importe_solicitado DECIMAL(15,2),
ADD COLUMN IF NOT EXISTS soc_l1_acompanamiento DECIMAL(15,2),
ADD COLUMN IF NOT EXISTS soc_l2_contratacion DECIMAL(15,2),
ADD COLUMN IF NOT EXISTS fecha_primer_abono DATE,
ADD COLUMN IF NOT EXISTS segundo_abono DECIMAL(15,2),
ADD COLUMN IF NOT EXISTS fecha_segundo_abono DATE,
ADD COLUMN IF NOT EXISTS prevision_pago TEXT,
ADD COLUMN IF NOT EXISTS fecha_justificacion DATE,
ADD COLUMN IF NOT EXISTS revisado_gestoria BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS holded_asentamiento TEXT,
ADD COLUMN IF NOT EXISTS importes_por_cobrar DECIMAL(15,2);

-- Crear índices para los nuevos campos importantes
CREATE INDEX IF NOT EXISTS idx_subvenciones_expediente ON public.subvenciones(expediente);
CREATE INDEX IF NOT EXISTS idx_subvenciones_codigo ON public.subvenciones(codigo);
CREATE INDEX IF NOT EXISTS idx_subvenciones_modalidad ON public.subvenciones(modalidad);
CREATE INDEX IF NOT EXISTS idx_subvenciones_fecha_adjudicacion ON public.subvenciones(fecha_adjudicacion);
CREATE INDEX IF NOT EXISTS idx_subvenciones_revisado_gestoria ON public.subvenciones(revisado_gestoria);

-- Comentarios para documentar los campos
COMMENT ON COLUMN public.subvenciones.expediente IS 'Número de expediente de la subvención';
COMMENT ON COLUMN public.subvenciones.codigo IS 'Código identificativo de la subvención';
COMMENT ON COLUMN public.subvenciones.modalidad IS 'Modalidad de la subvención (ej: Línea de ayudas)';
COMMENT ON COLUMN public.subvenciones.fecha_adjudicacion IS 'Fecha en que se adjudicó la subvención';
COMMENT ON COLUMN public.subvenciones.importe_solicitado IS 'Importe solicitado originalmente';
COMMENT ON COLUMN public.subvenciones.soc_l1_acompanamiento IS 'Importe SOC L1 Acompañamiento';
COMMENT ON COLUMN public.subvenciones.soc_l2_contratacion IS 'Importe SOC L2 Contratación';
COMMENT ON COLUMN public.subvenciones.fecha_primer_abono IS 'Fecha del primer abono recibido';
COMMENT ON COLUMN public.subvenciones.segundo_abono IS 'Importe del segundo abono';
COMMENT ON COLUMN public.subvenciones.fecha_segundo_abono IS 'Fecha del segundo abono';
COMMENT ON COLUMN public.subvenciones.prevision_pago IS 'Previsión de pago total (ej: Q2 2024)';
COMMENT ON COLUMN public.subvenciones.fecha_justificacion IS 'Fecha límite de justificación';
COMMENT ON COLUMN public.subvenciones.revisado_gestoria IS 'Indica si ha sido revisado por gestoría';
COMMENT ON COLUMN public.subvenciones.holded_asentamiento IS 'Estado del asentamiento en Holded';
COMMENT ON COLUMN public.subvenciones.importes_por_cobrar IS 'Importes pendientes de cobro';
