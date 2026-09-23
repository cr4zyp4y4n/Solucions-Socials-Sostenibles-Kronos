-- Sello PAdES / hoja de evidencias: hashes y metadatos del certificado de sello.
-- Ejecutar en Supabase tras desplegar portal-firma con sealPdfWithEvidence.

alter table if exists public.firma_documentos
  add column if not exists sha256_original text,
  add column if not exists sha256_firmado text,
  add column if not exists seal_cert_serial text,
  add column if not exists seal_cert_issuer text,
  add column if not exists sealed_at timestamptz;

comment on column public.firma_documentos.sha256_original is
  'SHA-256 hex del PDF original (bytes antes de evidencias/PAdES).';
comment on column public.firma_documentos.sha256_firmado is
  'SHA-256 hex del PDF final sellado (tras hoja de evidencias + PAdES).';
comment on column public.firma_documentos.seal_cert_serial is
  'Número de serie del certificado P12 usado en el sello electrónico.';
comment on column public.firma_documentos.seal_cert_issuer is
  'Emisor (DN) del certificado de sello.';
comment on column public.firma_documentos.sealed_at is
  'Momento UTC en que se aplicó el sello PAdES (ISO).';

-- hash_pdf histórico sigue existiendo; sha256_original es la fuente de verdad post-sello.

notify pgrst, 'reload schema';
