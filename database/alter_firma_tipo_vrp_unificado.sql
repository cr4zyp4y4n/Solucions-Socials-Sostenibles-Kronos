-- Unificar VRP: un solo tipo `vrp` (aceptación o renuncia en el portal).
-- Se mantienen vrp_consentimiento / vrp_renuncia por documentos ya creados.
-- Ejecutar en Supabase SQL Editor.

alter table if exists public.firma_documentos
  drop constraint if exists firma_documentos_tipo_documento_check;

alter table if exists public.firma_documentos
  add constraint firma_documentos_tipo_documento_check
  check (
    tipo_documento in (
      'contrato',
      'anexo',
      'oferta_empleo',
      'riesgos_laborales',
      'riesgos_psicosociales',
      'epis',
      'vrp',
      'vrp_consentimiento',
      'vrp_renuncia',
      'formacion_prl',
      'acoso',
      'protocol_citas_medicas',
      'protocol_absencies',
      'pdp',
      'confidencialidad',
      'registro_horario',
      'normas_internas',
      'igualdad',
      'baja',
      'otro'
    )
  );

alter table if exists public.firma_plantillas
  drop constraint if exists firma_plantillas_tipo_chk;

alter table if exists public.firma_plantillas
  add constraint firma_plantillas_tipo_chk
  check (
    tipo_documento in (
      'contrato',
      'anexo',
      'oferta_empleo',
      'riesgos_laborales',
      'riesgos_psicosociales',
      'epis',
      'vrp',
      'vrp_consentimiento',
      'vrp_renuncia',
      'formacion_prl',
      'acoso',
      'protocol_citas_medicas',
      'protocol_absencies',
      'pdp',
      'confidencialidad',
      'registro_horario',
      'normas_internas',
      'igualdad',
      'baja',
      'otro'
    )
  );

notify pgrst, 'reload schema';
