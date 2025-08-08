    -- Script para implementar control de visibilidad de facturas
    -- Ejecutar este script en el SQL Editor de Supabase

    -- 1. Crear tabla de control de visibilidad de facturas
    CREATE TABLE IF NOT EXISTS public.invoice_visibility (
        id SERIAL PRIMARY KEY,
        invoice_id TEXT NOT NULL, -- Cambiado de UUID a TEXT para aceptar identificadores de Holded
        hidden_for_role TEXT NOT NULL CHECK (hidden_for_role IN ('manager', 'admin', 'management', 'user')),
        hidden_by UUID REFERENCES auth.users(id),
        hidden_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        reason TEXT,
        UNIQUE(invoice_id, hidden_for_role)
    );

    -- 2. Crear índices para mejorar rendimiento
    CREATE INDEX IF NOT EXISTS idx_invoice_visibility_invoice_id ON public.invoice_visibility(invoice_id);
    CREATE INDEX IF NOT EXISTS idx_invoice_visibility_role ON public.invoice_visibility(hidden_for_role);
    CREATE INDEX IF NOT EXISTS idx_invoice_visibility_hidden_by ON public.invoice_visibility(hidden_by);

    -- 3. Habilitar RLS en la tabla
    ALTER TABLE public.invoice_visibility ENABLE ROW LEVEL SECURITY;

    -- 4. Crear políticas RLS para invoice_visibility
    -- Primero eliminar políticas existentes si las hay
    DROP POLICY IF EXISTS "Users can view own visibility controls" ON public.invoice_visibility;
    DROP POLICY IF EXISTS "Management and admin can create visibility controls" ON public.invoice_visibility;
    DROP POLICY IF EXISTS "Management and admin can update visibility controls" ON public.invoice_visibility;
    DROP POLICY IF EXISTS "Management and admin can delete visibility controls" ON public.invoice_visibility;

    -- Política para SELECT: usuarios pueden ver las ocultaciones que han creado
    CREATE POLICY "Users can view own visibility controls" ON public.invoice_visibility
    FOR SELECT USING (
        hidden_by = auth.uid()
        OR
        -- Management y admin pueden ver todas las ocultaciones
        EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE id = auth.uid() 
        AND role IN ('management', 'admin')
        )
    );

    -- Política para INSERT: management y admin pueden crear ocultaciones
    CREATE POLICY "Management and admin can create visibility controls" ON public.invoice_visibility
    FOR INSERT WITH CHECK (
        EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE id = auth.uid() 
        AND role IN ('management', 'admin')
        )
    );

    -- Política para UPDATE: management y admin pueden actualizar ocultaciones
    CREATE POLICY "Management and admin can update visibility controls" ON public.invoice_visibility
    FOR UPDATE USING (
        EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE id = auth.uid() 
        AND role IN ('management', 'admin')
        )
    );

    -- Política para DELETE: management y admin pueden eliminar ocultaciones
    CREATE POLICY "Management and admin can delete visibility controls" ON public.invoice_visibility
    FOR DELETE USING (
        EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE id = auth.uid() 
        AND role IN ('management', 'admin')
        )
    );

    -- 5. Crear función helper para verificar si una factura está oculta para un rol
    -- Primero eliminar la función existente si existe
    DROP FUNCTION IF EXISTS is_invoice_hidden_for_role(UUID, TEXT);

    CREATE OR REPLACE FUNCTION is_invoice_hidden_for_role(
        invoice_identifier TEXT,
        user_role TEXT
    )
    RETURNS BOOLEAN
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $$
    BEGIN
        RETURN EXISTS (
            SELECT 1 
            FROM public.invoice_visibility 
            WHERE invoice_id = invoice_identifier 
            AND hidden_for_role = user_role
        );
    END;
    $$;

    -- 6. Crear función para obtener facturas visibles para un rol específico
    -- Primero eliminar la función existente si existe
    DROP FUNCTION IF EXISTS get_visible_invoices_for_role(TEXT);

    CREATE OR REPLACE FUNCTION get_visible_invoices_for_role(user_role TEXT)
    RETURNS TABLE (
        id UUID,
        upload_id UUID,
        invoice_number TEXT,
        internal_number TEXT,
        issue_date DATE,
        accounting_date DATE,
        due_date DATE,
        provider TEXT,
        description TEXT,
        tags TEXT,
        account TEXT,
        project TEXT,
        subtotal DECIMAL(15,2),
        vat DECIMAL(15,2),
        retention DECIMAL(15,2),
        employees DECIMAL(15,2),
        equipment_recovery DECIMAL(15,2),
        total DECIMAL(15,2),
        paid BOOLEAN,
        pending DECIMAL(15,2),
        status TEXT,
        payment_date DATE,
        processed_at TIMESTAMP WITH TIME ZONE,
        created_by UUID,
        holded_id TEXT,
        holded_contact_id TEXT,
        document_type TEXT
    )
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $$
    BEGIN
        RETURN QUERY
        SELECT i.*
        FROM public.invoices i
        WHERE NOT EXISTS (
            SELECT 1 
            FROM public.invoice_visibility iv 
            WHERE iv.invoice_id = i.id::text
            AND iv.hidden_for_role = user_role
        );
    END;
    $$;

    -- 7. Verificar que la tabla se creó correctamente
    SELECT 
        'Table created successfully' as status,
        COUNT(*) as total_invoices,
        (SELECT COUNT(*) FROM public.invoice_visibility) as total_visibility_controls
    FROM public.invoices;

    -- 8. Mostrar las políticas RLS creadas
    SELECT 
        schemaname, 
        tablename, 
        policyname, 
        permissive, 
        roles, 
        cmd, 
        qual 
    FROM pg_policies 
    WHERE tablename = 'invoice_visibility' 
    AND schemaname = 'public'
    ORDER BY policyname; 