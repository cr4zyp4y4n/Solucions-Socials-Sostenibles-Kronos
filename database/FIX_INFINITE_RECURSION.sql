    -- 🔧 ARREGLO DEFINITIVO: Eliminar recursión infinita en políticas RLS

    -- 1. ELIMINAR TODAS las políticas que causan recursión
    DROP POLICY IF EXISTS "Users can view profiles based on role and status" ON user_profiles;
    DROP POLICY IF EXISTS "Admins can update all profiles, users can update own (except disabled)" ON user_profiles;
    DROP POLICY IF EXISTS "user_profiles_select_policy" ON user_profiles;
    DROP POLICY IF EXISTS "user_profiles_update_policy" ON user_profiles;
    DROP POLICY IF EXISTS "user_profiles_insert_policy" ON user_profiles;
    DROP POLICY IF EXISTS "user_profiles_delete_policy" ON user_profiles;
    DROP POLICY IF EXISTS "Users can view their own profile and admins can view all" ON user_profiles;
    DROP POLICY IF EXISTS "Only admins can update user profiles" ON user_profiles;
    DROP POLICY IF EXISTS "Users can view own profile, admins can view all" ON user_profiles;
    DROP POLICY IF EXISTS "Users can update own profile, admins can update all" ON user_profiles;
    DROP POLICY IF EXISTS "Users can insert own profile, admins can insert any" ON user_profiles;
    DROP POLICY IF EXISTS "Only admins can delete profiles" ON user_profiles;

    -- 2. CREAR FUNCIÓN SECURITY DEFINER para verificar si un usuario es admin
    -- Esto evita la recursión porque la función se ejecuta con permisos elevados
    CREATE OR REPLACE FUNCTION public.is_admin()
    RETURNS BOOLEAN
    LANGUAGE sql
    SECURITY DEFINER
    SET search_path = public
    STABLE
    AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_profiles
        WHERE id = auth.uid()
        AND role = 'admin'
    );
    $$;

    -- 3. CREAR POLÍTICAS SIN RECURSIÓN usando la función

    -- Política SELECT: admins ven todo, usuarios solo su perfil
    CREATE POLICY "enable_select_for_users_and_admins"
    ON user_profiles
    FOR SELECT
    USING (
        auth.uid() = id 
        OR public.is_admin()
    );

    -- Política UPDATE: admins actualizan todo, usuarios solo lo suyo
    CREATE POLICY "enable_update_for_users_and_admins"
    ON user_profiles
    FOR UPDATE
    USING (
        auth.uid() = id 
        OR public.is_admin()
    )
    WITH CHECK (
        auth.uid() = id 
        OR public.is_admin()
    );

    -- Política INSERT: usuarios pueden crear su propio perfil, admins pueden crear cualquiera
    CREATE POLICY "enable_insert_for_users_and_admins"
    ON user_profiles
    FOR INSERT
    WITH CHECK (
        auth.uid() = id 
        OR public.is_admin()
    );

    -- Política DELETE: solo admins pueden eliminar
    CREATE POLICY "enable_delete_for_admins_only"
    ON user_profiles
    FOR DELETE
    USING (public.is_admin());

    -- 4. Agregar el campo disabled si no existe
    ALTER TABLE user_profiles 
    ADD COLUMN IF NOT EXISTS disabled BOOLEAN DEFAULT FALSE;

    -- 5. Crear índice para disabled
    CREATE INDEX IF NOT EXISTS idx_user_profiles_disabled 
    ON user_profiles(disabled);

    -- 6. Verificar que las políticas se crearon correctamente
    SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    cmd
    FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'user_profiles'
    ORDER BY policyname;

    -- ✅ LISTO: Las políticas ahora NO tienen recursión infinita



