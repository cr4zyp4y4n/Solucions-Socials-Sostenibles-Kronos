-- OCR de DNI/NIE en la foto de identidad (señal para admin; no bloquea la firma).
-- Ejecutar en Supabase SQL Editor.

alter table if exists public.firma_envios
  add column if not exists identidad_ocr_status text,
  add column if not exists identidad_ocr_match boolean,
  add column if not exists identidad_ocr_confianza numeric(4,3),
  add column if not exists identidad_ocr_dni_detectado text,
  add column if not exists identidad_ocr_at timestamptz,
  add column if not exists identidad_ocr_detalle jsonb;

comment on column public.firma_envios.identidad_ocr_status is
  'pending | match | no_match | ilegible | error | skipped — resultado OCR vs DNI del trabajador.';
comment on column public.firma_envios.identidad_ocr_match is
  'true si el OCR detectó el DNI/NIE esperado en la foto (señal advisory).';
comment on column public.firma_envios.identidad_ocr_confianza is
  'Confianza 0–1 del match OCR (aproximada).';
comment on column public.firma_envios.identidad_ocr_dni_detectado is
  'Mejor candidato DNI/NIE leído por OCR (normalizado).';
comment on column public.firma_envios.identidad_ocr_at is
  'Momento del último análisis OCR.';
comment on column public.firma_envios.identidad_ocr_detalle is
  'Detalle técnico: engine, candidatos, snippet, errores.';

alter table if exists public.firma_documentos
  add column if not exists identidad_ocr_status text,
  add column if not exists identidad_ocr_match boolean,
  add column if not exists identidad_ocr_confianza numeric(4,3),
  add column if not exists identidad_ocr_dni_detectado text,
  add column if not exists identidad_ocr_at timestamptz,
  add column if not exists identidad_ocr_detalle jsonb;

comment on column public.firma_documentos.identidad_ocr_status is
  'OCR identidad (legacy sin envio_id).';
comment on column public.firma_documentos.identidad_ocr_match is
  'Match OCR vs DNI (legacy).';
comment on column public.firma_documentos.identidad_ocr_confianza is
  'Confianza OCR (legacy).';
comment on column public.firma_documentos.identidad_ocr_dni_detectado is
  'DNI detectado por OCR (legacy).';
comment on column public.firma_documentos.identidad_ocr_at is
  'Timestamp OCR (legacy).';
comment on column public.firma_documentos.identidad_ocr_detalle is
  'Detalle OCR (legacy).';

notify pgrst, 'reload schema';
