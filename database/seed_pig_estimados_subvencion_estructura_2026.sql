-- Estimado E.I L1 2026 para hoja PIG ESTRUCTURA SUBV 740 (33.610,44 € / 12 meses).
-- Requiere: alter_pig_estimados_subvencion_add_estructura.sql

insert into public.pig_estimados_subvencion (linea, year, slot, segment, month_from, month_to, amount)
values
  ('ESTRUCTURA', 2026, 1, 1, 1, 12, 2800.87)
on conflict (linea, year, slot, segment) do update
set amount = excluded.amount,
    month_from = excluded.month_from,
    month_to = excluded.month_to,
    updated_at = now();
