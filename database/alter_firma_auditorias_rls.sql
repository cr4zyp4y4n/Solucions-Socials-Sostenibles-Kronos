-- Lectura de auditoría de firma desde Kronos (usuarios autenticados).
-- El portal escribe con service role; Kronos solo necesita SELECT.

alter table if exists public.firma_auditorias enable row level security;

drop policy if exists "read firma auditorias" on public.firma_auditorias;
create policy "read firma auditorias"
  on public.firma_auditorias
  for select
  to authenticated
  using (true);

notify pgrst, 'reload schema';
