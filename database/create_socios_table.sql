-- Script SQL para crear la tabla de socios de IDONI en Supabase
-- Ejecutar este script en el SQL Editor de Supabase

-- Crear la tabla socios_idoni
CREATE TABLE IF NOT EXISTS socios_idoni (
    id BIGSERIAL PRIMARY KEY,
    id_unico INTEGER UNIQUE NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    correo VARCHAR(255) UNIQUE NOT NULL,
    socio_desde DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_socios_id_unico ON socios_idoni(id_unico);
CREATE INDEX IF NOT EXISTS idx_socios_correo ON socios_idoni(correo);
CREATE INDEX IF NOT EXISTS idx_socios_nombre ON socios_idoni(nombre);
CREATE INDEX IF NOT EXISTS idx_socios_apellido ON socios_idoni(apellido);
CREATE INDEX IF NOT EXISTS idx_socios_socio_desde ON socios_idoni(socio_desde);

-- Crear función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Crear trigger para actualizar updated_at
DROP TRIGGER IF EXISTS update_socios_idoni_updated_at ON socios_idoni;
CREATE TRIGGER update_socios_idoni_updated_at
    BEFORE UPDATE ON socios_idoni
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Configurar Row Level Security (RLS)
ALTER TABLE socios_idoni ENABLE ROW LEVEL SECURITY;

-- Política para permitir lectura a todos los usuarios autenticados
CREATE POLICY "Permitir lectura a usuarios autenticados" ON socios_idoni
    FOR SELECT USING (auth.role() = 'authenticated');

-- Política para permitir inserción solo a usuarios con rol admin, jefe o tienda
CREATE POLICY "Permitir inserción a administradores y tienda" ON socios_idoni
    FOR INSERT WITH CHECK (
        auth.role() = 'authenticated' AND 
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE auth.users.id = auth.uid() 
            AND (
                auth.users.raw_user_meta_data->>'role' = 'admin' OR
                auth.users.raw_user_meta_data->>'role' = 'administrador' OR
                auth.users.raw_user_meta_data->>'role' = 'jefe' OR
                auth.users.raw_user_meta_data->>'role' = 'tienda'
            )
        )
    );

-- Política para permitir actualización solo a usuarios con rol admin, jefe o tienda
CREATE POLICY "Permitir actualización a administradores y tienda" ON socios_idoni
    FOR UPDATE USING (
        auth.role() = 'authenticated' AND 
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE auth.users.id = auth.uid() 
            AND (
                auth.users.raw_user_meta_data->>'role' = 'admin' OR
                auth.users.raw_user_meta_data->>'role' = 'administrador' OR
                auth.users.raw_user_meta_data->>'role' = 'jefe' OR
                auth.users.raw_user_meta_data->>'role' = 'tienda'
            )
        )
    );

-- Política para permitir eliminación solo a usuarios con rol admin o jefe
CREATE POLICY "Permitir eliminación a administradores" ON socios_idoni
    FOR DELETE USING (
        auth.role() = 'authenticated' AND 
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE auth.users.id = auth.uid() 
            AND (
                auth.users.raw_user_meta_data->>'role' = 'admin' OR
                auth.users.raw_user_meta_data->>'role' = 'administrador' OR
                auth.users.raw_user_meta_data->>'role' = 'jefe'
            )
        )
    );

-- Insertar algunos datos de ejemplo (opcional)
-- INSERT INTO socios_idoni (id_unico, nombre, apellido, correo, socio_desde) VALUES
-- (10001, 'Juan', 'Pérez', 'juan.perez@ejemplo.com', '2024-01-15'),
-- (10002, 'María', 'García', 'maria.garcia@ejemplo.com', '2024-02-20'),
-- (10003, 'Carlos', 'López', 'carlos.lopez@ejemplo.com', '2024-03-10');

-- Comentarios sobre la tabla
COMMENT ON TABLE socios_idoni IS 'Tabla para gestionar los socios de IDONI (agrobotiga)';
COMMENT ON COLUMN socios_idoni.id_unico IS 'ID único de 5 dígitos para identificar al socio';
COMMENT ON COLUMN socios_idoni.nombre IS 'Nombre del socio';
COMMENT ON COLUMN socios_idoni.apellido IS 'Apellido del socio';
COMMENT ON COLUMN socios_idoni.correo IS 'Correo electrónico del socio (único)';
COMMENT ON COLUMN socios_idoni.socio_desde IS 'Fecha desde la que es socio';
