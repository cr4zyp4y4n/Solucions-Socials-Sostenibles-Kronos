-- =====================================================
-- MIGRACIÓN: Tabla de Productos IDONI/BONCOR
-- =====================================================
-- Esta tabla almacena los productos de proveedores IDONI/BONCOR
-- detectados en las hojas de ruta para su confirmación

-- Crear tabla de productos IDONI/BONCOR
CREATE TABLE IF NOT EXISTS productos_idoni (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hoja_ruta_id UUID NOT NULL REFERENCES hojas_ruta(id) ON DELETE CASCADE,
    producto TEXT NOT NULL,
    cantidad TEXT,
    proveedor TEXT NOT NULL,
    estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'disponible', 'no_disponible')),
    orden INTEGER NOT NULL DEFAULT 0,
    fecha_actualizacion TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_productos_idoni_hoja_ruta ON productos_idoni(hoja_ruta_id);
CREATE INDEX IF NOT EXISTS idx_productos_idoni_estado ON productos_idoni(estado);
CREATE INDEX IF NOT EXISTS idx_productos_idoni_proveedor ON productos_idoni(proveedor);
CREATE INDEX IF NOT EXISTS idx_productos_idoni_created_at ON productos_idoni(created_at DESC);

-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_productos_idoni_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_productos_idoni_updated_at
    BEFORE UPDATE ON productos_idoni
    FOR EACH ROW
    EXECUTE FUNCTION update_productos_idoni_updated_at();

-- RLS (Row Level Security) Policies
ALTER TABLE productos_idoni ENABLE ROW LEVEL SECURITY;

-- Política: Todos pueden ver productos
CREATE POLICY "Todos pueden ver productos IDONI"
    ON productos_idoni
    FOR SELECT
    USING (true);

-- Política: Usuarios autenticados pueden insertar productos
CREATE POLICY "Usuarios autenticados pueden insertar productos IDONI"
    ON productos_idoni
    FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

-- Política: Usuarios autenticados pueden actualizar productos
CREATE POLICY "Usuarios autenticados pueden actualizar productos IDONI"
    ON productos_idoni
    FOR UPDATE
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- Política: Usuarios autenticados pueden eliminar productos
CREATE POLICY "Usuarios autenticados pueden eliminar productos IDONI"
    ON productos_idoni
    FOR DELETE
    USING (auth.role() = 'authenticated');

-- Comentarios para documentación
COMMENT ON TABLE productos_idoni IS 'Productos de proveedores IDONI/BONCOR detectados en hojas de ruta';
COMMENT ON COLUMN productos_idoni.hoja_ruta_id IS 'ID de la hoja de ruta a la que pertenece el producto';
COMMENT ON COLUMN productos_idoni.producto IS 'Nombre del producto';
COMMENT ON COLUMN productos_idoni.cantidad IS 'Cantidad del producto';
COMMENT ON COLUMN productos_idoni.proveedor IS 'Proveedor del producto (IDONI, BONCOR, IDONI BONCOR)';
COMMENT ON COLUMN productos_idoni.estado IS 'Estado de disponibilidad: pendiente, disponible, no_disponible';
COMMENT ON COLUMN productos_idoni.orden IS 'Orden del producto en la lista';
COMMENT ON COLUMN productos_idoni.fecha_actualizacion IS 'Fecha de última actualización del estado';
