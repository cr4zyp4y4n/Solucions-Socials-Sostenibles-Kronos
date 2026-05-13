-- OPCIONAL: solo si en Supabase la tabla firma_otp_challenges tiene RLS activo
-- y en la consola de Kronos ves: [firma] firma_otp_challenges (merge OTP): permission denied
-- (o 0 filas al listar challenges).
--
-- La app Kronos usa el rol "authenticated" de Supabase Auth. El portal usa service_role
-- y no necesita esta política.
--
-- 1) Comprueba si RLS está activo en firma_otp_challenges (Table editor).
-- 2) Si está activo y no hay política SELECT para authenticated, ejecuta SOLO lo que necesites.

alter table if exists public.firma_otp_challenges enable row level security;

drop policy if exists "firma_otp_challenges_select_authenticated" on public.firma_otp_challenges;
create policy "firma_otp_challenges_select_authenticated"
  on public.firma_otp_challenges
  for select
  to authenticated
  using (true);
