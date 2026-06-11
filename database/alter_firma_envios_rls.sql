-- Permisos RLS para firma_envios (packs multi-documento).
-- Ejecutar en Supabase si Kronos muestra error al crear packs:
-- "new row violates row-level security policy for table firma_envios"
--
-- Requiere haber ejecutado antes create_firma_envios.sql

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

-- Refrescar caché de PostgREST (opcional pero recomendado tras migraciones)
notify pgrst, 'reload schema';
