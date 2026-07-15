-- Valores iniciales objetivos COMPARATIVA ANUAL 2026.
-- Requiere: create_pig_objetivos_comparativa.sql

insert into public.pig_objetivos_comparativa (linea, year, variant, amount)
values
  ('CATERING', 2026, 'normal', 650000),
  ('CATERING', 2026, 'optim', 600000),
  ('IDONI', 2026, 'normal', 140000),
  ('IDONI', 2026, 'optim', 150000),
  ('KOIKI', 2026, 'normal', 20207),
  ('KOIKI', 2026, 'optim', 23881)
on conflict (linea, year, variant) do update
set amount = excluded.amount,
    updated_at = now();
