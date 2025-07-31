-- Esquema de base de datos para IDONI - Ventas de Productos
-- Ejecutar este script en el SQL Editor de Supabase

-- Tabla de ventas de productos de IDONI
CREATE TABLE IF NOT EXISTS public.idoni_ventas_productos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  article_codi VARCHAR(50) NOT NULL,
  article_descripcio VARCHAR(255) NOT NULL,
  quantitat_unit INTEGER,
  quantitat_kgs DECIMAL(10,2),
  venda_pvp DECIMAL(10,2),
  venda_import DECIMAL(10,2),
  cost_preu DECIMAL(10,2),
  cost_import DECIMAL(10,2),
  marge_sobre_cost_percent DECIMAL(5,2),
  marge_sobre_cost_import DECIMAL(10,2),
  operacions VARCHAR(100),
  data_venta DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_idoni_ventas_productos_article_codi ON public.idoni_ventas_productos(article_codi);
CREATE INDEX IF NOT EXISTS idx_idoni_ventas_productos_article_descripcio ON public.idoni_ventas_productos(article_descripcio);
CREATE INDEX IF NOT EXISTS idx_idoni_ventas_productos_data_venta ON public.idoni_ventas_productos(data_venta);
CREATE INDEX IF NOT EXISTS idx_idoni_ventas_productos_operacions ON public.idoni_ventas_productos(operacions);

-- Trigger para updated_at
CREATE TRIGGER update_idoni_ventas_productos_updated_at 
  BEFORE UPDATE ON public.idoni_ventas_productos 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Habilitar RLS en la tabla
ALTER TABLE public.idoni_ventas_productos ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para idoni_ventas_productos
CREATE POLICY "All authenticated users can view IDONI ventas productos" ON public.idoni_ventas_productos
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "All authenticated users can insert IDONI ventas productos" ON public.idoni_ventas_productos
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "All authenticated users can update IDONI ventas productos" ON public.idoni_ventas_productos
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "All authenticated users can delete IDONI ventas productos" ON public.idoni_ventas_productos
  FOR DELETE USING (auth.role() = 'authenticated'); 