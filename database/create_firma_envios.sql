-- Pack de firma: un enlace con varios PDFs (contratación, EPIS, PRL, acoso…)
-- Ejecutar en Supabase antes de usar envíos multi-documento.

create table if not exists public.firma_envios (
  id uuid primary key default gen_random_uuid(),
  trabajador_id uuid not null references public.firma_trabajadores (id) on delete restrict,
  nombre text,
  estado text not null default 'pendiente',
  fecha_inicio date,
  fecha_fin date,
  notas_internas text,
  token_actual_id uuid,
  link_compartido_at timestamptz,
  portal_abierto_at timestamptz,
  otp_primera_solicitud_at timestamptz,
  firmado_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.firma_envios is 'Envío de firma (pack): un token/enlace, N documentos PDF.';

alter table if exists public.firma_documentos
  add column if not exists envio_id uuid references public.firma_envios (id) on delete cascade,
  add column if not exists orden int not null default 0,
  add column if not exists revisado_at timestamptz;

comment on column public.firma_documentos.revisado_at is 'Primera visualización del PDF en el portal (pack multi-doc).';

alter table if exists public.firma_tokens
  add column if not exists envio_id uuid references public.firma_envios (id) on delete cascade;

alter table if exists public.firma_otp_challenges
  add column if not exists envio_id uuid references public.firma_envios (id) on delete cascade;

create index if not exists idx_firma_documentos_envio_id on public.firma_documentos (envio_id);
create index if not exists idx_firma_tokens_envio_id on public.firma_tokens (envio_id);
create index if not exists idx_firma_envios_trabajador_id on public.firma_envios (trabajador_id);

-- RLS (mismo criterio que otras tablas de Kronos: lectura authenticated, escritura admin/management/manager)
alter table if exists public.firma_envios enable row level security;

drop policy if exists "read firma envios" on public.firma_envios;
create policy "read firma envios"
  on public.firma_envios
  for select
  to authenticated
  using (true);

drop policy if exists "write firma envios privileged" on public.firma_envios;
create policy "write firma envios privileged"
  on public.firma_envios
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
