-- Objetivos anuales para la hoja COMPARATIVA ANUAL del PIG (normal / òptim per línia).

create table if not exists public.pig_objetivos_comparativa (
  id uuid not null default gen_random_uuid(),
  linea text not null,
  year int not null,
  variant text not null,
  amount numeric(15, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pig_objetivos_comparativa_pkey primary key (id),
  constraint pig_objetivos_comparativa_linea_chk check (linea in ('CATERING','IDONI','KOIKI')),
  constraint pig_objetivos_comparativa_year_chk check (year >= 2000 and year <= 2100),
  constraint pig_objetivos_comparativa_variant_chk check (variant in ('normal','optim')),
  constraint pig_objetivos_comparativa_unique unique (linea, year, variant)
);

create index if not exists idx_pig_objetivos_comparativa_year
  on public.pig_objetivos_comparativa (year);

drop trigger if exists set_pig_objetivos_comparativa_updated_at on public.pig_objetivos_comparativa;
create trigger set_pig_objetivos_comparativa_updated_at
before update on public.pig_objetivos_comparativa
for each row execute function public.set_updated_at_timestamp();
