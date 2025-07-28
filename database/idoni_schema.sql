-- Esquema de base de datos para IDONI - Ventas de Tienda
-- Ejecutar este script en el SQL Editor de Supabase

-- Tabla de ventas diarias de IDONI
CREATE TABLE IF NOT EXISTS public.idoni_ventas_diarias (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  data DATE NOT NULL,
  dia_setmana VARCHAR(20),
  c_bot INTEGER,
  nom_botiga VARCHAR(100),
  c_ven INTEGER,
  kgs DECIMAL(10,2),
  unit INTEGER,
  import DECIMAL(10,2),
  tiquets INTEGER,
  mitja_tiq DECIMAL(10,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de ventas por horas de IDONI
CREATE TABLE IF NOT EXISTS public.idoni_ventas_horas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  data DATE NOT NULL,
  num_tiquet INTEGER,
  hora TIME,
  c_bot INTEGER,
  nom_botiga VARCHAR(100),
  c_cli INTEGER,
  c_ven INTEGER,
  total DECIMAL(10,2),
  balanca DECIMAL(10,2),
  seccio VARCHAR(50),
  oper VARCHAR(50),
  albaran VARCHAR(50),
  forma_pag VARCHAR(50),
  id_bd VARCHAR(50),
  efectiu DECIMAL(10,2),
  targeta DECIMAL(10,2),
  credit DECIMAL(10,2),
  xec DECIMAL(10,2),
  a_compte DECIMAL(10,2),
  data_cobrament DATE,
  web DECIMAL(10,2),
  delivery DECIMAL(10,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_idoni_ventas_diarias_data ON public.idoni_ventas_diarias(data);
CREATE INDEX IF NOT EXISTS idx_idoni_ventas_diarias_botiga ON public.idoni_ventas_diarias(nom_botiga);
CREATE INDEX IF NOT EXISTS idx_idoni_ventas_diarias_dia_setmana ON public.idoni_ventas_diarias(dia_setmana);

CREATE INDEX IF NOT EXISTS idx_idoni_ventas_horas_data ON public.idoni_ventas_horas(data);
CREATE INDEX IF NOT EXISTS idx_idoni_ventas_horas_botiga ON public.idoni_ventas_horas(nom_botiga);
CREATE INDEX IF NOT EXISTS idx_idoni_ventas_horas_hora ON public.idoni_ventas_horas(hora);
CREATE INDEX IF NOT EXISTS idx_idoni_ventas_horas_tiquet ON public.idoni_ventas_horas(num_tiquet);

-- Triggers para updated_at
CREATE TRIGGER update_idoni_ventas_diarias_updated_at 
  BEFORE UPDATE ON public.idoni_ventas_diarias 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_idoni_ventas_horas_updated_at 
  BEFORE UPDATE ON public.idoni_ventas_horas 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Habilitar RLS en las tablas
ALTER TABLE public.idoni_ventas_diarias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.idoni_ventas_horas ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para idoni_ventas_diarias
CREATE POLICY "All authenticated users can view IDONI ventas diarias" ON public.idoni_ventas_diarias
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "All authenticated users can insert IDONI ventas diarias" ON public.idoni_ventas_diarias
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "All authenticated users can update IDONI ventas diarias" ON public.idoni_ventas_diarias
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "All authenticated users can delete IDONI ventas diarias" ON public.idoni_ventas_diarias
  FOR DELETE USING (auth.role() = 'authenticated');

-- Políticas RLS para idoni_ventas_horas
CREATE POLICY "All authenticated users can view IDONI ventas horas" ON public.idoni_ventas_horas
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "All authenticated users can insert IDONI ventas horas" ON public.idoni_ventas_horas
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "All authenticated users can update IDONI ventas horas" ON public.idoni_ventas_horas
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "All authenticated users can delete IDONI ventas horas" ON public.idoni_ventas_horas
  FOR DELETE USING (auth.role() = 'authenticated'); 