-- Ampliar tipos de documento de firma (pack contratación: RPT, EPIS, acoso, VRP…)
-- Ejecutar en Supabase si al crear un pack sale:
-- violates check constraint "firma_documentos_tipo_documento_check"
--
-- El esquema original solo permitía: contrato, baja, anexo.
-- Debe coincidir con src/constants/firmaDocumentos.js

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
      'epis',
      'vrp_consentimiento',
      'vrp_renuncia',
      'formacion_prl',
      'acoso',
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
