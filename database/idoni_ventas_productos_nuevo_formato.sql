-- Esquema de base de datos para IDONI - Nuevo Formato de Ventas por Productos
-- Este archivo contiene las tablas para el nuevo formato de Excel de ventas por productos

-- Tabla de ventas de productos por importe (nuevo formato)
CREATE TABLE IF NOT EXISTS idoni_ventas_productos_importe (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    codi TEXT NOT NULL,
    descripcio TEXT NOT NULL,
    gener DECIMAL(15,2) DEFAULT 0,
    febrer DECIMAL(15,2) DEFAULT 0,
    marc DECIMAL(15,2) DEFAULT 0,
    abril DECIMAL(15,2) DEFAULT 0,
    maig DECIMAL(15,2) DEFAULT 0,
    juny DECIMAL(15,2) DEFAULT 0,
    juliol DECIMAL(15,2) DEFAULT 0,
    agost DECIMAL(15,2) DEFAULT 0,
    setembre DECIMAL(15,2) DEFAULT 0,
    octubre DECIMAL(15,2) DEFAULT 0,
    novembre DECIMAL(15,2) DEFAULT 0,
    desembre DECIMAL(15,2) DEFAULT 0,
    total DECIMAL(15,2) DEFAULT 0,
    data_importacio DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de ventas de productos por cantidad (nuevo formato)
CREATE TABLE IF NOT EXISTS idoni_ventas_productos_cantidad (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    codi TEXT NOT NULL,
    descripcio TEXT NOT NULL,
    gener DECIMAL(15,2) DEFAULT 0,
    febrer DECIMAL(15,2) DEFAULT 0,
    marc DECIMAL(15,2) DEFAULT 0,
    abril DECIMAL(15,2) DEFAULT 0,
    maig DECIMAL(15,2) DEFAULT 0,
    juny DECIMAL(15,2) DEFAULT 0,
    juliol DECIMAL(15,2) DEFAULT 0,
    agost DECIMAL(15,2) DEFAULT 0,
    setembre DECIMAL(15,2) DEFAULT 0,
    octubre DECIMAL(15,2) DEFAULT 0,
    novembre DECIMAL(15,2) DEFAULT 0,
    desembre DECIMAL(15,2) DEFAULT 0,
    total DECIMAL(15,2) DEFAULT 0,
    data_importacio DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para mejorar el rendimiento de consultas
CREATE INDEX IF NOT EXISTS idx_idoni_ventas_productos_importe_codi ON idoni_ventas_productos_importe(codi);
CREATE INDEX IF NOT EXISTS idx_idoni_ventas_productos_importe_data_importacio ON idoni_ventas_productos_importe(data_importacio);
CREATE INDEX IF NOT EXISTS idx_idoni_ventas_productos_cantidad_codi ON idoni_ventas_productos_cantidad(codi);
CREATE INDEX IF NOT EXISTS idx_idoni_ventas_productos_cantidad_data_importacio ON idoni_ventas_productos_cantidad(data_importacio);

-- Políticas RLS (Row Level Security) para las nuevas tablas
ALTER TABLE idoni_ventas_productos_importe ENABLE ROW LEVEL SECURITY;
ALTER TABLE idoni_ventas_productos_cantidad ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas existentes si las hay (para evitar conflictos)
DROP POLICY IF EXISTS "Administradores pueden hacer todo en idoni_ventas_productos_importe" ON idoni_ventas_productos_importe;
DROP POLICY IF EXISTS "Administradores pueden hacer todo en idoni_ventas_productos_cantidad" ON idoni_ventas_productos_cantidad;
DROP POLICY IF EXISTS "Managers pueden leer idoni_ventas_productos_importe" ON idoni_ventas_productos_importe;
DROP POLICY IF EXISTS "Managers pueden leer idoni_ventas_productos_cantidad" ON idoni_ventas_productos_cantidad;
DROP POLICY IF EXISTS "Usuarios pueden leer idoni_ventas_productos_importe" ON idoni_ventas_productos_importe;
DROP POLICY IF EXISTS "Usuarios pueden leer idoni_ventas_productos_cantidad" ON idoni_ventas_productos_cantidad;

-- Políticas simplificadas que permiten acceso completo a usuarios autenticados
-- Esto es temporal para permitir que funcione la inserción de datos
CREATE POLICY "Permitir todo para usuarios autenticados en idoni_ventas_productos_importe" ON idoni_ventas_productos_importe
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Permitir todo para usuarios autenticados en idoni_ventas_productos_cantidad" ON idoni_ventas_productos_cantidad
    FOR ALL USING (auth.role() = 'authenticated');

-- Función para actualizar el timestamp updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para actualizar updated_at automáticamente
CREATE TRIGGER update_idoni_ventas_productos_importe_updated_at 
    BEFORE UPDATE ON idoni_ventas_productos_importe 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_idoni_ventas_productos_cantidad_updated_at 
    BEFORE UPDATE ON idoni_ventas_productos_cantidad 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comentarios para documentar las tablas
COMMENT ON TABLE idoni_ventas_productos_importe IS 'Tabla para almacenar ventas de productos por importe (nuevo formato Excel)';
COMMENT ON TABLE idoni_ventas_productos_cantidad IS 'Tabla para almacenar ventas de productos por cantidad (nuevo formato Excel)';
COMMENT ON COLUMN idoni_ventas_productos_importe.codi IS 'Código del producto';
COMMENT ON COLUMN idoni_ventas_productos_importe.descripcio IS 'Descripción del producto';
COMMENT ON COLUMN idoni_ventas_productos_importe.gener IS 'Ventas del mes de enero por importe';
COMMENT ON COLUMN idoni_ventas_productos_importe.febrer IS 'Ventas del mes de febrero por importe';
COMMENT ON COLUMN idoni_ventas_productos_importe.marc IS 'Ventas del mes de marzo por importe';
COMMENT ON COLUMN idoni_ventas_productos_importe.abril IS 'Ventas del mes de abril por importe';
COMMENT ON COLUMN idoni_ventas_productos_importe.maig IS 'Ventas del mes de mayo por importe';
COMMENT ON COLUMN idoni_ventas_productos_importe.juny IS 'Ventas del mes de junio por importe';
COMMENT ON COLUMN idoni_ventas_productos_importe.juliol IS 'Ventas del mes de julio por importe';
COMMENT ON COLUMN idoni_ventas_productos_importe.agost IS 'Ventas del mes de agosto por importe';
COMMENT ON COLUMN idoni_ventas_productos_importe.setembre IS 'Ventas del mes de septiembre por importe';
COMMENT ON COLUMN idoni_ventas_productos_importe.octubre IS 'Ventas del mes de octubre por importe';
COMMENT ON COLUMN idoni_ventas_productos_importe.novembre IS 'Ventas del mes de noviembre por importe';
COMMENT ON COLUMN idoni_ventas_productos_importe.desembre IS 'Ventas del mes de diciembre por importe';
COMMENT ON COLUMN idoni_ventas_productos_importe.total IS 'Total anual por importe';
COMMENT ON COLUMN idoni_ventas_productos_importe.data_importacio IS 'Fecha de importación de los datos';

COMMENT ON COLUMN idoni_ventas_productos_cantidad.codi IS 'Código del producto';
COMMENT ON COLUMN idoni_ventas_productos_cantidad.descripcio IS 'Descripción del producto';
COMMENT ON COLUMN idoni_ventas_productos_cantidad.gener IS 'Ventas del mes de enero por cantidad';
COMMENT ON COLUMN idoni_ventas_productos_cantidad.febrer IS 'Ventas del mes de febrero por cantidad';
COMMENT ON COLUMN idoni_ventas_productos_cantidad.marc IS 'Ventas del mes de marzo por cantidad';
COMMENT ON COLUMN idoni_ventas_productos_cantidad.abril IS 'Ventas del mes de abril por cantidad';
COMMENT ON COLUMN idoni_ventas_productos_cantidad.maig IS 'Ventas del mes de mayo por cantidad';
COMMENT ON COLUMN idoni_ventas_productos_cantidad.juny IS 'Ventas del mes de junio por cantidad';
COMMENT ON COLUMN idoni_ventas_productos_cantidad.juliol IS 'Ventas del mes de julio por cantidad';
COMMENT ON COLUMN idoni_ventas_productos_cantidad.agost IS 'Ventas del mes de agosto por cantidad';
COMMENT ON COLUMN idoni_ventas_productos_cantidad.setembre IS 'Ventas del mes de septiembre por cantidad';
COMMENT ON COLUMN idoni_ventas_productos_cantidad.octubre IS 'Ventas del mes de octubre por cantidad';
COMMENT ON COLUMN idoni_ventas_productos_cantidad.novembre IS 'Ventas del mes de noviembre por cantidad';
COMMENT ON COLUMN idoni_ventas_productos_cantidad.desembre IS 'Ventas del mes de diciembre por cantidad';
COMMENT ON COLUMN idoni_ventas_productos_cantidad.total IS 'Total anual por cantidad';
COMMENT ON COLUMN idoni_ventas_productos_cantidad.data_importacio IS 'Fecha de importación de los datos';
