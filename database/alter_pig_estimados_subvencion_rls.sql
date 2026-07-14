-- Políticas RLS para pig_estimados_subvencion (usuarios autenticados de Kronos).
-- Ejecutar en Supabase SQL Editor si el guardado falla por permisos.

alter table public.pig_estimados_subvencion enable row level security;

drop policy if exists "pig_estimados_subvencion_select" on public.pig_estimados_subvencion;
drop policy if exists "pig_estimados_subvencion_insert" on public.pig_estimados_subvencion;
drop policy if exists "pig_estimados_subvencion_update" on public.pig_estimados_subvencion;
drop policy if exists "pig_estimados_subvencion_delete" on public.pig_estimados_subvencion;

create policy "pig_estimados_subvencion_select"
  on public.pig_estimados_subvencion
  for select
  using (auth.role() = 'authenticated');

create policy "pig_estimados_subvencion_insert"
  on public.pig_estimados_subvencion
  for insert
  with check (auth.role() = 'authenticated');

create policy "pig_estimados_subvencion_update"
  on public.pig_estimados_subvencion
  for update
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "pig_estimados_subvencion_delete"
  on public.pig_estimados_subvencion
  for delete
  using (auth.role() = 'authenticated');
