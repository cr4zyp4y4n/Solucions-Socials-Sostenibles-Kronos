-- Script de migración para pasar datos de la tabla antigua a la nueva
-- EJECUTAR DESPUÉS de crear la nueva tabla con create_subvenciones_table_v2.sql

-- Insertar datos de la tabla antigua a la nueva (si existe)
INSERT INTO public.subvenciones (
    nombre,
    proyecto,
    imputacion,
    expediente,
    codigo_subvencion,
    modalidad,
    fecha_adjudicacion,
    importe_solicitado,
    importe_otorgado,
    periodo_ejecucion,
    soc_l1_acompanamiento,
    soc_l2_contratacion,
    primer_abono,
    fecha_primer_abono,
    segundo_abono,
    fecha_segundo_abono,
    saldo_pendiente,
    saldo_pendiente_texto,
    prevision_pago_total,
    fecha_justificacion,
    revisado_gestoria,
    estado,
    holded_asentamiento,
    importes_por_cobrar,
    fecha_creacion,
    fecha_modificacion,
    created_by,
    updated_by
)
SELECT 
    nombre,
    organismo as proyecto,
    imputacion,
    expediente,
    codigo as codigo_subvencion,
    modalidad,
    fecha_adjudicacion,
    importe_solicitado,
    importe_otorgado,
    periodo_ejecucion,
    soc_l1_acompanamiento,
    soc_l2_contratacion,
    primer_abono,
    fecha_primer_abono,
    segundo_abono,
    fecha_segundo_abono,
    saldo_pendiente,
    saldo_pendiente_texto,
    prevision_pago as prevision_pago_total,
    fecha_justificacion,
    revisado_gestoria,
    estado,
    holded_asentamiento,
    importes_por_cobrar,
    fecha_creacion,
    fecha_modificacion,
    created_by,
    updated_by
FROM public.subvenciones_old
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'subvenciones_old');

-- Renombrar tabla antigua para backup
ALTER TABLE IF EXISTS public.subvenciones RENAME TO subvenciones_old;

-- Renombrar nueva tabla
ALTER TABLE public.subvenciones_new RENAME TO subvenciones;

-- Comentario de confirmación
COMMENT ON TABLE public.subvenciones IS 'Tabla de subvenciones v2 - Migrada desde tabla anterior';
