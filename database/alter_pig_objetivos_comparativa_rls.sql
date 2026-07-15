-- Políticas RLS para pig_objetivos_comparativa (usuarios autenticados de Kronos).

alter table public.pig_objetivos_comparativa enable row level security;

drop policy if exists "pig_objetivos_comparativa_select" on public.pig_objetivos_comparativa;
drop policy if exists "pig_objetivos_comparativa_insert" on public.pig_objetivos_comparativa;
drop policy if exists "pig_objetivos_comparativa_update" on public.pig_objetivos_comparativa;
drop policy if exists "pig_objetivos_comparativa_delete" on public.pig_objetivos_comparativa;

create policy "pig_objetivos_comparativa_select"
  on public.pig_objetivos_comparativa
  for select
  using (auth.role() = 'authenticated');

create policy "pig_objetivos_comparativa_insert"
  on public.pig_objetivos_comparativa
  for insert
  with check (auth.role() = 'authenticated');

create policy "pig_objetivos_comparativa_update"
  on public.pig_objetivos_comparativa
  for update
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "pig_objetivos_comparativa_delete"
  on public.pig_objetivos_comparativa
  for delete
  using (auth.role() = 'authenticated');
