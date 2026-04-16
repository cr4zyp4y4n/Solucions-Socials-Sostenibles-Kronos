-- Carga inicial de bases históricas 2025 para COMPARATIVA ANUAL
-- Requiere haber ejecutado antes: create_pig_bases_historicas.sql

insert into public.pig_bases_historicas (linea, year, month, base)
values
  -- CATERING 2025
  ('CATERING', 2025, 1, 24150.45),
  ('CATERING', 2025, 2, 45445.27),
  ('CATERING', 2025, 3, 33990.45),
  ('CATERING', 2025, 4, 36084.00),
  ('CATERING', 2025, 5, 71747.15),
  ('CATERING', 2025, 6, 53763.54),
  ('CATERING', 2025, 7, 30229.10),
  ('CATERING', 2025, 8, 24000.00),
  ('CATERING', 2025, 9, 24868.32),
  ('CATERING', 2025, 10, 92242.02),
  ('CATERING', 2025, 11, 54053.28),
  ('CATERING', 2025, 12, 64326.96),

  -- IDONI 2025
  ('IDONI', 2025, 1, 14296.37),
  ('IDONI', 2025, 2, 11980.23),
  ('IDONI', 2025, 3, 12886.44),
  ('IDONI', 2025, 4, 15096.14),
  ('IDONI', 2025, 5, 22252.68),
  ('IDONI', 2025, 6, 11597.56),
  ('IDONI', 2025, 7, 16384.84),
  ('IDONI', 2025, 8, 4990.96),
  ('IDONI', 2025, 9, 10909.44),
  ('IDONI', 2025, 10, 10703.20),
  ('IDONI', 2025, 11, 9868.63),
  ('IDONI', 2025, 12, 21367.48),

  -- KOIKI 2025
  ('KOIKI', 2025, 1, 1068.85),
  ('KOIKI', 2025, 2, 1159.05),
  ('KOIKI', 2025, 3, 0.00),
  ('KOIKI', 2025, 4, 2488.70),
  ('KOIKI', 2025, 5, 1168.51),
  ('KOIKI', 2025, 6, 1069.27),
  ('KOIKI', 2025, 7, 968.82),
  ('KOIKI', 2025, 8, 158.53),
  ('KOIKI', 2025, 9, 946.05),
  ('KOIKI', 2025, 10, 807.80),
  ('KOIKI', 2025, 11, 0.00),
  ('KOIKI', 2025, 12, 0.00)
on conflict (linea, year, month)
do update set
  base = excluded.base,
  updated_at = now();

