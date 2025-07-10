# 🔧 Solución del Error: "new row violates row-level security policy for table 'invoices'"

## ❌ Problema
El error indica que las políticas RLS (Row Level Security) de la tabla `invoices` están impidiendo la inserción de datos. Esto puede deberse a:
1. Políticas RLS mal configuradas
2. Estructura de tabla incorrecta
3. Problemas con las relaciones entre tablas

## ✅ Solución Aplicada

### 1. **Script SQL para corregir la estructura y políticas:**

**Ejecuta este script en el SQL Editor de Supabase:**

```sql
-- Script para verificar y corregir la estructura de la tabla invoices
-- Ejecutar este script en el SQL Editor de Supabase

-- 1. Verificar la estructura actual de invoices
SELECT 
  'Current invoices structure' as info,
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'invoices' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Verificar las restricciones de clave foránea
SELECT 
  'Foreign key constraints' as info,
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
AND tc.table_name = 'invoices';

-- 3. Si la tabla no tiene la estructura correcta, la recreamos
-- Primero, hacer backup de los datos existentes
CREATE TEMP TABLE invoices_backup AS 
SELECT * FROM public.invoices;

-- Eliminar la tabla actual
DROP TABLE IF EXISTS public.invoices CASCADE;

-- Crear la tabla invoices con la estructura correcta
CREATE TABLE public.invoices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  upload_id UUID REFERENCES public.excel_uploads(id) ON DELETE CASCADE,
  invoice_number TEXT,
  internal_number TEXT,
  issue_date DATE,
  accounting_date DATE,
  due_date DATE,
  provider TEXT NOT NULL,
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
  paid BOOLEAN DEFAULT FALSE,
  pending DECIMAL(15,2),
  status TEXT,
  payment_date DATE,
  processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Restaurar los datos del backup
INSERT INTO public.invoices (
  id, upload_id, invoice_number, internal_number, issue_date, accounting_date,
  due_date, provider, description, tags, account, project, subtotal, vat,
  retention, employees, equipment_recovery, total, paid, pending, status,
  payment_date, processed_at, created_by
)
SELECT 
  id, upload_id, invoice_number, internal_number, issue_date, accounting_date,
  due_date, provider, description, tags, account, project, subtotal, vat,
  retention, employees, equipment_recovery, total, paid, pending, status,
  payment_date, processed_at, created_by
FROM invoices_backup;

-- 4. Crear índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_invoices_provider ON public.invoices(provider);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON public.invoices(issue_date);
CREATE INDEX IF NOT EXISTS idx_invoices_upload ON public.invoices(upload_id);
CREATE INDEX IF NOT EXISTS idx_invoices_created_by ON public.invoices(created_by);

-- 5. Habilitar RLS
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- 6. Crear políticas RLS
DROP POLICY IF EXISTS "Users can view invoices from own uploads" ON public.invoices;
DROP POLICY IF EXISTS "Users can insert invoices for own uploads" ON public.invoices;
DROP POLICY IF EXISTS "Users can update invoices from own uploads" ON public.invoices;
DROP POLICY IF EXISTS "Users can delete invoices from own uploads" ON public.invoices;

-- Política para SELECT (ver facturas)
CREATE POLICY "Users can view invoices from own uploads" ON public.invoices
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.excel_uploads 
      WHERE id = invoices.upload_id 
      AND uploaded_by = auth.uid()
    )
  );

-- Política para INSERT (insertar facturas)
CREATE POLICY "Users can insert invoices for own uploads" ON public.invoices
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.excel_uploads 
      WHERE id = invoices.upload_id 
      AND uploaded_by = auth.uid()
    )
  );

-- Política para UPDATE (actualizar facturas)
CREATE POLICY "Users can update invoices from own uploads" ON public.invoices
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.excel_uploads 
      WHERE id = invoices.upload_id 
      AND uploaded_by = auth.uid()
    )
  );

-- Política para DELETE (eliminar facturas)
CREATE POLICY "Users can delete invoices from own uploads" ON public.invoices
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.excel_uploads 
      WHERE id = invoices.upload_id 
      AND uploaded_by = auth.uid()
    )
  );

-- 7. Verificar la estructura final
SELECT 
  'Final invoices structure' as info,
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'invoices' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 8. Verificar las políticas RLS
SELECT 
  'RLS Policies' as info,
  policyname, 
  cmd, 
  qual 
FROM pg_policies 
WHERE tablename = 'invoices' 
AND schemaname = 'public'
ORDER BY policyname;
```

### 2. **Script adicional para corregir solo las políticas RLS:**

Si solo necesitas corregir las políticas sin recrear la tabla:

```sql
-- Script para corregir solo las políticas RLS de invoices
-- Ejecutar este script en el SQL Editor de Supabase

-- 1. Eliminar políticas problemáticas
DROP POLICY IF EXISTS "Users can view invoices from own uploads" ON public.invoices;
DROP POLICY IF EXISTS "Users can insert invoices for own uploads" ON public.invoices;
DROP POLICY IF EXISTS "Users can update invoices from own uploads" ON public.invoices;
DROP POLICY IF EXISTS "Users can delete invoices from own uploads" ON public.invoices;

-- 2. Crear políticas RLS corregidas
CREATE POLICY "Users can view invoices from own uploads" ON public.invoices
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.excel_uploads 
      WHERE id = invoices.upload_id 
      AND uploaded_by = auth.uid()
    )
  );

CREATE POLICY "Users can insert invoices for own uploads" ON public.invoices
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.excel_uploads 
      WHERE id = invoices.upload_id 
      AND uploaded_by = auth.uid()
    )
  );

CREATE POLICY "Users can update invoices from own uploads" ON public.invoices
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.excel_uploads 
      WHERE id = invoices.upload_id 
      AND uploaded_by = auth.uid()
    )
  );

CREATE POLICY "Users can delete invoices from own uploads" ON public.invoices
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.excel_uploads 
      WHERE id = invoices.upload_id 
      AND uploaded_by = auth.uid()
    )
  );

-- 3. Verificar que RLS está habilitado
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
```

## 🚀 Pasos para probar:

### 1. **Ejecutar el script SQL:**
- Ve a tu proyecto Supabase
- Ve a SQL Editor
- Copia y pega el script completo
- Ejecuta el script

### 2. **Probar la aplicación:**
- Reinicia la aplicación si está corriendo
- Ve a la página principal
- Intenta subir un archivo Excel
- Verifica que no aparezcan errores en la consola

### 3. **Verificar que funciona:**
- ✅ El archivo se sube sin errores
- ✅ Los metadatos se guardan correctamente
- ✅ Los datos se procesan y guardan en la tabla `invoices`
- ✅ Puedes ver los datos en Analytics y Providers

## 🔍 Verificación:

### En Supabase Dashboard:
1. **Database > Tables > invoices**
2. **Verifica que la tabla tenga estas columnas:**
   - ✅ `id` (UUID, PRIMARY KEY)
   - ✅ `upload_id` (UUID, FOREIGN KEY)
   - ✅ `provider` (TEXT, NOT NULL)
   - ✅ `total` (DECIMAL)
   - ✅ `paid` (BOOLEAN)
   - ✅ `created_by` (UUID, FOREIGN KEY)
   - ✅ `processed_at` (TIMESTAMP)

3. **Database > Tables > invoices > Policies**
4. **Verifica que existan estas políticas:**
   - ✅ "Users can view invoices from own uploads"
   - ✅ "Users can insert invoices for own uploads"
   - ✅ "Users can update invoices from own uploads"
   - ✅ "Users can delete invoices from own uploads"

### En la aplicación:
1. **Sube un archivo Excel**
2. **Verifica en la consola que no hay errores**
3. **Verifica que los datos aparecen en Analytics**

## 📝 Notas importantes:

- **El script hace backup de los datos existentes** antes de recrear la tabla
- **Las políticas RLS verifican que el usuario sea propietario** del upload relacionado
- **La relación entre `invoices` y `excel_uploads`** debe estar correctamente configurada
- **El campo `upload_id` debe coincidir** con un registro existente en `excel_uploads`

## 🆘 Si persiste el error:

1. **Verifica que ejecutaste el script SQL completo**
2. **Revisa la consola del navegador** para errores específicos
3. **Verifica que el usuario está autenticado** correctamente
4. **Asegúrate de que el `upload_id` existe** en la tabla `excel_uploads`
5. **Verifica que las políticas RLS están activas** en Supabase Dashboard

## 🔧 Debugging adicional:

Si el error persiste, puedes ejecutar esta consulta para verificar el estado:

```sql
-- Verificar el estado de las políticas RLS
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  permissive, 
  roles, 
  cmd, 
  qual 
FROM pg_policies 
WHERE tablename = 'invoices' 
AND schemaname = 'public'
ORDER BY policyname;

-- Verificar que RLS está habilitado
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables 
WHERE tablename = 'invoices' 
AND schemaname = 'public';
```

---

**¡Con estos cambios, el error de RLS debería estar resuelto!** 🎉 