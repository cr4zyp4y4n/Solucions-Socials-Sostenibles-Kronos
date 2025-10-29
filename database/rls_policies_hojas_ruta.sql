-- =====================================================
-- Row Level Security (RLS) Policies para Hojas de Ruta
-- =====================================================

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

-- SELECT: Todos los usuarios autenticados pueden ver todas las hojas de ruta
CREATE POLICY "Usuarios autenticados pueden ver hojas de ruta"
ON hojas_ruta FOR SELECT
TO authenticated
USING (true);

-- INSERT: Todos los usuarios autenticados pueden crear hojas de ruta
CREATE POLICY "Usuarios autenticados pueden crear hojas de ruta"
ON hojas_ruta FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = created_by);

-- UPDATE: El creador o admin puede actualizar
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

-- DELETE: Solo admin puede eliminar
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

-- SELECT: Todos pueden ver el personal asignado
CREATE POLICY "Usuarios autenticados pueden ver personal"
ON hojas_ruta_personal FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM hojas_ruta 
        WHERE id = hojas_ruta_personal.hoja_ruta_id
    )
);

-- INSERT: Usuarios autenticados pueden añadir personal
CREATE POLICY "Usuarios autenticados pueden añadir personal"
ON hojas_ruta_personal FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM hojas_ruta 
        WHERE id = hojas_ruta_personal.hoja_ruta_id
        AND (
            created_by = auth.uid() 
            OR EXISTS (
                SELECT 1 FROM user_profiles 
                WHERE id = auth.uid() 
                AND role IN ('admin', 'administrador')
            )
        )
    )
);

-- UPDATE: Usuarios autenticados pueden actualizar horas
CREATE POLICY "Usuarios autenticados pueden actualizar personal"
ON hojas_ruta_personal FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM hojas_ruta 
        WHERE id = hojas_ruta_personal.hoja_ruta_id
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM hojas_ruta 
        WHERE id = hojas_ruta_personal.hoja_ruta_id
    )
);

-- DELETE: Solo creador o admin pueden eliminar
CREATE POLICY "Creador o admin puede eliminar personal"
ON hojas_ruta_personal FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM hojas_ruta 
        WHERE id = hojas_ruta_personal.hoja_ruta_id
        AND (
            created_by = auth.uid() 
            OR EXISTS (
                SELECT 1 FROM user_profiles 
                WHERE id = auth.uid() 
                AND role IN ('admin', 'administrador')
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
        WHERE id = hojas_ruta_equipamiento.hoja_ruta_id
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
        WHERE id = hojas_ruta_menus.hoja_ruta_id
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
        WHERE id = hojas_ruta_bebidas.hoja_ruta_id
    )
);

-- =====================================================
-- POLÍTICAS PARA: hojas_ruta_checklist
-- =====================================================

-- SELECT: Todos pueden ver checklist
CREATE POLICY "Usuarios autenticados pueden ver checklist"
ON hojas_ruta_checklist FOR SELECT
TO authenticated
USING (true);

-- INSERT: Usuarios autenticados pueden crear tareas
CREATE POLICY "Usuarios autenticados pueden crear tareas checklist"
ON hojas_ruta_checklist FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM hojas_ruta 
        WHERE id = hojas_ruta_checklist.hoja_ruta_id
    )
);

-- UPDATE: Todos pueden actualizar tareas (completar/descompletar)
CREATE POLICY "Usuarios autenticados pueden actualizar tareas checklist"
ON hojas_ruta_checklist FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- DELETE: Solo creador o admin pueden eliminar tareas
CREATE POLICY "Creador o admin puede eliminar tareas checklist"
ON hojas_ruta_checklist FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM hojas_ruta 
        WHERE id = hojas_ruta_checklist.hoja_ruta_id
        AND (
            created_by = auth.uid() 
            OR EXISTS (
                SELECT 1 FROM user_profiles 
                WHERE id = auth.uid() 
                AND role IN ('admin', 'administrador')
            )
        )
    )
);

