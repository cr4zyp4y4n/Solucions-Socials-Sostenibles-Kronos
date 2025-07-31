# 🚀 Configuración de Supabase - SSS Kronos

## Paso 1: Crear proyecto en Supabase

1. **Ve a [supabase.com](https://supabase.com)**
2. **Haz clic en "Start your project"**
3. **Inicia sesión con GitHub o crea una cuenta**
4. **Crea un nuevo proyecto:**
   - Nombre: `sss-kronos` (o el que prefieras)
   - Contraseña de base de datos: Anota esta contraseña
   - Región: Elige la más cercana a ti
   - Plan: Free tier (gratuito)

## Paso 2: Obtener credenciales

1. **En tu proyecto Supabase, ve a Settings > API**
2. **Copia estos valores:**
   - **Project URL**: `https://tu-proyecto-id.supabase.co`
   - **anon public**: `tu-anon-key-aqui`

## Paso 3: Configurar la base de datos

1. **Ve al SQL Editor en tu proyecto Supabase**
2. **Copia todo el contenido de `database/schema.sql`**
3. **Pega y ejecuta el script**
4. **Verifica que se crearon las tablas en Database > Tables**

## Paso 4: Configurar autenticación

1. **Ve a Authentication > Settings**
2. **En "Site URL" pon:** `http://localhost:3000`
3. **En "Redirect URLs" agrega:** `http://localhost:3000`
4. **Guarda los cambios**

## Paso 5: Configurar la aplicación

1. **Copia el archivo de ejemplo:**
   ```bash
   cp src/config/supabase.example.js src/config/supabase.js
   ```

2. **Edita `src/config/supabase.js`:**
   - Reemplaza `SUPABASE_URL` con tu Project URL
   - Reemplaza `SUPABASE_ANON_KEY` con tu anon public key

3. **Ejecuta la aplicación:**
   ```bash
   npm start
   ```

## Paso 6: Probar la autenticación

1. **La aplicación se abrirá**
2. **Verás la pantalla de login**
3. **Haz clic en "Crear cuenta"**
4. **Registra un usuario de prueba**
5. **Inicia sesión**

## ✅ Verificación

### ✅ Base de datos configurada:
- [ ] Tablas creadas en Database > Tables
- [ ] RLS habilitado en todas las tablas
- [ ] Políticas de seguridad aplicadas

### ✅ Autenticación funcionando:
- [ ] Puedes registrar usuarios
- [ ] Puedes iniciar sesión
- [ ] Los perfiles se crean automáticamente

### ✅ Aplicación conectada:
- [ ] La app se conecta a Supabase
- [ ] El login funciona
- [ ] Puedes cerrar sesión

## 🔧 Solución de problemas

### Error: "Invalid API key"
- Verifica que copiaste correctamente la anon key
- Asegúrate de que no hay espacios extra

### Error: "Database connection failed"
- Verifica que la Project URL es correcta
- Asegúrate de que ejecutaste el schema.sql

### Error: "RLS policy violation"
- Verifica que ejecutaste todas las políticas RLS del schema
- Asegúrate de que el usuario está autenticado

### La app no se conecta
- Verifica que las credenciales están en `src/config/supabase.js`
- Asegúrate de que el archivo existe y está bien configurado

## 📊 Estructura de la base de datos

Después de ejecutar el schema, tendrás estas tablas:

### `user_profiles`
- Extensión de `auth.users` de Supabase
- Almacena nombre y rol del usuario
- Se crea automáticamente al registrar

### `excel_uploads`
- Registro de archivos Excel subidos
- Metadatos del archivo y usuario
- Estado de procesamiento

### `invoices`
- Datos de facturas procesadas
- Relacionado con `excel_uploads`
- Campos para análisis financiero

### `providers`
- Información de proveedores
- Datos de contacto
- Historial de facturas

### `analytics`
- Estadísticas automáticas
- Se actualiza con triggers
- Datos para gráficos

## 🔐 Seguridad

### Row Level Security (RLS)
- **Habilitado en todas las tablas**
- **Políticas basadas en roles**
- **Usuarios solo ven sus datos**
- **Admins ven todo**

### Roles de usuario:
- **Admin**: Acceso completo
- **Manager**: Gestiona equipo
- **User**: Solo sus datos

## 🎯 Próximos pasos

1. **Probar subida de archivos Excel**
2. **Configurar análisis automático**
3. **Personalizar interfaz según necesidades**
4. **Generar instalador con `npm run build`**

---

**¡Listo! Tu aplicación SSS Kronos está conectada a Supabase y lista para usar.** 