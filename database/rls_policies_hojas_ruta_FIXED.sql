-- =====================================================
-- Row Level Security (RLS) Policies para Hojas de Ruta
-- VERSIÓN CORREGIDA
-- =====================================================

-- Primero, eliminar políticas existentes si existen (para evitar conflictos)
DROP POLICY IF EXISTS "Usuarios autenticados pueden ver hojas de ruta" ON hojas_ruta;
DROP POLICY IF EXISTS "Usuarios autenticados pueden crear hojas de ruta" ON hojas_ruta;
DROP POLICY IF EXISTS "Creador o admin puede actualizar hojas de ruta" ON hojas_ruta;
DROP POLICY IF EXISTS "Solo admin puede eliminar hojas de ruta" ON hojas_ruta;

DROP POLICY IF EXISTS "Usuarios autenticados pueden ver personal" ON hojas_ruta_personal;
DROP POLICY IF EXISTS "Usuarios autenticados pueden añadir personal" ON hojas_ruta_personal;
DROP POLICY IF EXISTS "Usuarios autenticados pueden actualizar personal" ON hojas_ruta_personal;
DROP POLICY IF EXISTS "Creador o admin puede eliminar personal" ON hojas_ruta_personal;

DROP POLICY IF EXISTS "Usuarios autenticados pueden ver equipamiento" ON hojas_ruta_equipamiento;
DROP POLICY IF EXISTS "Usuarios autenticados pueden gestionar equipamiento" ON hojas_ruta_equipamiento;

DROP POLICY IF EXISTS "Usuarios autenticados pueden ver menus" ON hojas_ruta_menus;
DROP POLICY IF EXISTS "Usuarios autenticados pueden gestionar menus" ON hojas_ruta_menus;

DROP POLICY IF EXISTS "Usuarios autenticados pueden ver bebidas" ON hojas_ruta_bebidas;
DROP POLICY IF EXISTS "Usuarios autenticados pueden gestionar bebidas" ON hojas_ruta_bebidas;

DROP POLICY IF EXISTS "Usuarios autenticados pueden ver checklist" ON hojas_ruta_checklist;
DROP POLICY IF EXISTS "Usuarios autenticados pueden crear tareas checklist" ON hojas_ruta_checklist;
DROP POLICY IF EXISTS "Usuarios autenticados pueden actualizar tareas checklist" ON hojas_ruta_checklist;
DROP POLICY IF EXISTS "Creador o admin puede eliminar tareas checklist" ON hojas_ruta_checklist;

-- Habilitar RLS en todas las tablas
ALTER TABLE hojas_ruta ENABLE ROW LEVEL SECURITY;
ALTER TABLE hojas_ruta_personal ENABLE ROW LEVEL SECURITY;
ALTER TABLE hojas_ruta_equipamiento ENABLE ROW LEVEL SECURITY;
ALTER TABLE hojas_ruta_menus ENABLE ROW LEVEL SECURITY;
ALTER TABLE hojas_ruta_bebidas ENABLE ROW LEVEL SECURITY;
ALTER TABLE hojas_ruta_checklist ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- POLÍTICAS PARA: hojas_ruta
-- =====================================================

CREATE POLICY "Usuarios autenticados pueden ver hojas de ruta"
ON hojas_ruta FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Usuarios autenticados pueden crear hojas de ruta"
ON hojas_ruta FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Creador o admin puede actualizar hojas de ruta"
ON hojas_ruta FOR UPDATE
TO authenticated
USING (
    created_by = auth.uid() 
    OR EXISTS (
        SELECT 1 FROM user_profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'administrador')
    )
)
WITH CHECK (
    created_by = auth.uid() 
    OR EXISTS (
        SELECT 1 FROM user_profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'administrador')
    )
);

CREATE POLICY "Solo admin puede eliminar hojas de ruta"
ON hojas_ruta FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM user_profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'administrador')
    )
);

-- =====================================================
-- POLÍTICAS PARA: hojas_ruta_personal
-- =====================================================

CREATE POLICY "Usuarios autenticados pueden ver personal"
ON hojas_ruta_personal FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM hojas_ruta 
        WHERE hojas_ruta.id = hojas_ruta_personal.hoja_ruta_id
    )
);

CREATE POLICY "Usuarios autenticados pueden añadir personal"
ON hojas_ruta_personal FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM hojas_ruta 
        WHERE hojas_ruta.id = hojas_ruta_personal.hoja_ruta_id
        AND (
            hojas_ruta.created_by = auth.uid() 
            OR EXISTS (
                SELECT 1 FROM user_profiles 
                WHERE user_profiles.id = auth.uid() 
                AND user_profiles.role IN ('admin', 'administrador')
            )
        )
    )
);

CREATE POLICY "Usuarios autenticados pueden actualizar personal"
ON hojas_ruta_personal FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM hojas_ruta 
        WHERE hojas_ruta.id = hojas_ruta_personal.hoja_ruta_id
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM hojas_ruta 
        WHERE hojas_ruta.id = hojas_ruta_personal.hoja_ruta_id
    )
);

CREATE POLICY "Creador o admin puede eliminar personal"
ON hojas_ruta_personal FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM hojas_ruta 
        WHERE hojas_ruta.id = hojas_ruta_personal.hoja_ruta_id
        AND (
            hojas_ruta.created_by = auth.uid() 
            OR EXISTS (
                SELECT 1 FROM user_profiles 
                WHERE user_profiles.id = auth.uid() 
                AND user_profiles.role IN ('admin', 'administrador')
            )
        )
    )
);

-- =====================================================
-- POLÍTICAS PARA: hojas_ruta_equipamiento
-- =====================================================

CREATE POLICY "Usuarios autenticados pueden ver equipamiento"
ON hojas_ruta_equipamiento FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Usuarios autenticados pueden gestionar equipamiento"
ON hojas_ruta_equipamiento FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM hojas_ruta 
        WHERE hojas_ruta.id = hojas_ruta_equipamiento.hoja_ruta_id
    )
);

-- =====================================================
-- POLÍTICAS PARA: hojas_ruta_menus
-- =====================================================

CREATE POLICY "Usuarios autenticados pueden ver menus"
ON hojas_ruta_menus FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Usuarios autenticados pueden gestionar menus"
ON hojas_ruta_menus FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM hojas_ruta 
        WHERE hojas_ruta.id = hojas_ruta_menus.hoja_ruta_id
    )
);

-- =====================================================
-- POLÍTICAS PARA: hojas_ruta_bebidas
-- =====================================================

CREATE POLICY "Usuarios autenticados pueden ver bebidas"
ON hojas_ruta_bebidas FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Usuarios autenticados pueden gestionar bebidas"
ON hojas_ruta_bebidas FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM hojas_ruta 
        WHERE hojas_ruta.id = hojas_ruta_bebidas.hoja_ruta_id
    )
);

-- =====================================================
-- POLÍTICAS PARA: hojas_ruta_checklist
-- =====================================================

CREATE POLICY "Usuarios autenticados pueden ver checklist"
ON hojas_ruta_checklist FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Usuarios autenticados pueden crear tareas checklist"
ON hojas_ruta_checklist FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM hojas_ruta 
        WHERE hojas_ruta.id = hojas_ruta_checklist.hoja_ruta_id
    )
);

CREATE POLICY "Usuarios autenticados pueden actualizar tareas checklist"
ON hojas_ruta_checklist FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Creador o admin puede eliminar tareas checklist"
ON hojas_ruta_checklist FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM hojas_ruta 
        WHERE hojas_ruta.id = hojas_ruta_checklist.hoja_ruta_id
        AND (
            hojas_ruta.created_by = auth.uid() 
            OR EXISTS (
                SELECT 1 FROM user_profiles 
                WHERE user_profiles.id = auth.uid() 
                AND user_profiles.role IN ('admin', 'administrador')
            )
        )
    )
);

