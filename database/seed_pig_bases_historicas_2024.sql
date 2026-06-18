-- Bases históricas 2024 para COMPARATIVA ANUAL (columna BASE 2024 al generar PIG 2026)
-- Requiere haber ejecutado antes: create_pig_bases_historicas.sql

insert into public.pig_bases_historicas (linea, year, month, base)
values
  -- CATERING 2024 (total acumulado: 510.566,50 €)
  ('CATERING', 2024, 1, 16675.63),
  ('CATERING', 2024, 2, 34444.35),
  ('CATERING', 2024, 3, 31688.33),
  ('CATERING', 2024, 4, 23797.23),
  ('CATERING', 2024, 5, 62001.72),
  ('CATERING', 2024, 6, 64109.93),
  ('CATERING', 2024, 7, 51543.42),
  ('CATERING', 2024, 8, 0.00),
  ('CATERING', 2024, 9, 28529.52),
  ('CATERING', 2024, 10, 99723.71),
  ('CATERING', 2024, 11, 52183.66),
  ('CATERING', 2024, 12, 45869.00),

  -- IDONI 2024 (total acumulado: 85.032,23 €)
  ('IDONI', 2024, 1, 0.00),
  ('IDONI', 2024, 2, 0.00),
  ('IDONI', 2024, 3, 0.00),
  ('IDONI', 2024, 4, 8659.96),
  ('IDONI', 2024, 5, 8921.72),
  ('IDONI', 2024, 6, 8770.40),
  ('IDONI', 2024, 7, 8489.19),
  ('IDONI', 2024, 8, 2377.82),
  ('IDONI', 2024, 9, 8412.98),
  ('IDONI', 2024, 10, 9782.84),
  ('IDONI', 2024, 11, 9776.04),
  ('IDONI', 2024, 12, 19841.28),

  -- KOIKI 2024 (total acumulado: 1.254,15 €)
  ('KOIKI', 2024, 1, 0.00),
  ('KOIKI', 2024, 2, 0.00),
  ('KOIKI', 2024, 3, 0.00),
  ('KOIKI', 2024, 4, 0.00),
  ('KOIKI', 2024, 5, 0.00),
  ('KOIKI', 2024, 6, 0.00),
  ('KOIKI', 2024, 7, 0.00),
  ('KOIKI', 2024, 8, 0.00),
  ('KOIKI', 2024, 9, 0.00),
  ('KOIKI', 2024, 10, 0.00),
  ('KOIKI', 2024, 11, 146.00),
  ('KOIKI', 2024, 12, 1108.15)
on conflict (linea, year, month)
do update set
  base = excluded.base,
  updated_at = now();
