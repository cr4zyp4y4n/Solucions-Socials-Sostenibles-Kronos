-- Plantillas PDF reutilizables por tipo de documento y empresa (Firma).
-- Una plantilla activa por (tipo_documento, entity_key).
-- Al crear un pack, si no hay PDF propio se usa la plantilla; si no hay plantilla, Kronos genera desde Holded (cuando aplica).

create table if not exists public.firma_plantillas (
  id uuid primary key default gen_random_uuid(),
  tipo_documento text not null,
  entity_key text not null,
  storage_path text not null,
  file_name text not null,
  hash_pdf text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint firma_plantillas_entity_chk check (entity_key in ('EI_SSS', 'MENJAR_DHORT')),
  constraint firma_plantillas_tipo_chk check (
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
  ),
  constraint firma_plantillas_unique unique (tipo_documento, entity_key)
);

comment on table public.firma_plantillas is
  'PDF plantilla por tipo de documento y empresa; se reutiliza en nuevos packs de Firma.';

create index if not exists idx_firma_plantillas_entity
  on public.firma_plantillas (entity_key);

drop trigger if exists set_firma_plantillas_updated_at on public.firma_plantillas;
create trigger set_firma_plantillas_updated_at
before update on public.firma_plantillas
for each row execute function public.set_updated_at_timestamp();

alter table public.firma_plantillas enable row level security;

drop policy if exists "firma_plantillas_select" on public.firma_plantillas;
drop policy if exists "firma_plantillas_write" on public.firma_plantillas;

create policy "firma_plantillas_select"
  on public.firma_plantillas
  for select
  to authenticated
  using (true);

create policy "firma_plantillas_write"
  on public.firma_plantillas
  for all
  to authenticated
  using (
    exists (
      select 1 from public.user_profiles up
      where up.id = auth.uid()
        and lower(coalesce(up.role, '')) in ('admin', 'management', 'manager')
    )
  )
  with check (
    exists (
      select 1 from public.user_profiles up
      where up.id = auth.uid()
        and lower(coalesce(up.role, '')) in ('admin', 'management', 'manager')
    )
  );

notify pgrst, 'reload schema';
