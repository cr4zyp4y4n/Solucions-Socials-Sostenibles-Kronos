-- Valores iniciales (sustituyen los hardcodeados anteriores en PIGPage).
-- Requiere haber ejecutado antes: create_pig_estimados_subvencion.sql

insert into public.pig_estimados_subvencion (linea, year, slot, segment, month_from, month_to, amount)
values
  ('CATERING', 2026, 1, 1, 1, 12, 1200),
  ('IDONI', 2026, 1, 1, 1, 12, 2500),
  ('KOIKI', 2026, 1, 1, 1, 12, 900)
on conflict (linea, year, slot, segment) do update
set amount = excluded.amount,
    month_from = excluded.month_from,
    month_to = excluded.month_to,
    updated_at = now();
