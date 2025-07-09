# SSS Kronos - Sistema de Gestión de Proveedores

Sistema moderno de gestión de proveedores y análisis de facturas desarrollado con Electron, React y Supabase.

## 🚀 Características

- **Autenticación segura** con Supabase Auth
- **Subida y procesamiento** de archivos Excel
- **Análisis en tiempo real** de facturas y proveedores
- **Interfaz moderna** con tema claro/oscuro
- **Roles de usuario** (Admin, Manager, User)
- **Base de datos PostgreSQL** en la nube con Supabase

## 📋 Requisitos Previos

- Node.js 18+ 
- npm o yarn
- Cuenta en Supabase (gratuita)

## 🛠️ Configuración

### 1. Configurar Supabase

1. **Crear proyecto en Supabase:**
   - Ve a [supabase.com](https://supabase.com)
   - Crea un nuevo proyecto
   - Guarda la URL y anon key

2. **Configurar la base de datos:**
   - Ve al SQL Editor en tu proyecto Supabase
   - Ejecuta el contenido de `database/schema.sql`

3. **Configurar autenticación:**
   - Ve a Authentication > Settings
   - Habilita Email auth
   - Configura las URLs de redirección si es necesario

### 2. Configurar la aplicación

1. **Instalar dependencias:**
   ```bash
   npm install
   ```

2. **Configurar variables de Supabase:**
   - Abre `src/config/supabase.js`
   - Reemplaza `SUPABASE_URL` y `SUPABASE_ANON_KEY` con tus credenciales

3. **Ejecutar la aplicación:**
   ```bash
   npm start
   ```

## 🏗️ Estructura del Proyecto

```
seleccion-proveedores/
├── src/
│   ├── components/          # Componentes React
│   │   ├── AuthContext.jsx  # Contexto de autenticación
│   │   ├── LoginPage.jsx    # Pantalla de login
│   │   ├── Layout.jsx       # Layout principal
│   │   └── ...
│   ├── config/
│   │   └── supabase.js      # Configuración de Supabase
│   └── assets/              # Imágenes y recursos
├── database/
│   └── schema.sql           # Esquema de base de datos
└── package.json
```

## 🔐 Autenticación y Roles

### Roles disponibles:
- **Admin**: Acceso completo a todas las funciones
- **Manager**: Puede ver y gestionar datos de su equipo
- **User**: Puede subir archivos y ver sus propios datos

### Flujo de autenticación:
1. Usuario accede a la aplicación
2. Si no está autenticado, ve la pantalla de login
3. Al iniciar sesión, se crea automáticamente su perfil
4. Accede a la aplicación principal según su rol

## 📊 Funcionalidades

### Subida de archivos Excel
- Soporte para archivos de Solucions Socials
- Procesamiento automático de datos
- Validación de formato y contenido

### Análisis de datos
- Estadísticas en tiempo real
- Gráficos de proveedores
- Análisis de pagos pendientes
- Filtros por fecha y proveedor

### Gestión de proveedores
- Lista de proveedores
- Información de contacto
- Historial de facturas

## 🎨 Diseño

La aplicación sigue un diseño minimalista con:
- **Colores de marca**: IDONI pink (#ff6b9d)
- **Tema claro/oscuro** automático
- **Iconos Feather** para consistencia
- **Animaciones suaves** con Framer Motion
- **Interfaz no seleccionable** en elementos visuales

## 🚀 Despliegue

### Generar instalador:
```bash
npm run build
```

### Distribuir:
- Los instaladores se generan en `out/`
- Soporte para Windows, macOS y Linux

## 🔧 Desarrollo

### Comandos útiles:
```bash
npm start          # Ejecutar en modo desarrollo
npm run build      # Generar instalador
npm run package    # Empaquetar aplicación
```

### Estructura de base de datos:
- `user_profiles`: Perfiles de usuario extendidos
- `excel_uploads`: Registro de archivos subidos
- `invoices`: Datos de facturas procesadas
- `providers`: Información de proveedores
- `analytics`: Estadísticas automáticas

## 📝 Notas Técnicas

### Seguridad:
- **Row Level Security (RLS)** habilitado en todas las tablas
- **Políticas de acceso** basadas en roles
- **Autenticación JWT** con Supabase

### Rendimiento:
- **Índices optimizados** en campos frecuentes
- **Triggers automáticos** para analytics
- **Caché de sesión** persistente

### Escalabilidad:
- **Base de datos PostgreSQL** en la nube
- **API REST automática** de Supabase
- **Arquitectura modular** para fácil expansión

## 🤝 Contribución

1. Fork el proyecto
2. Crea una rama para tu feature
3. Commit tus cambios
4. Push a la rama
5. Abre un Pull Request

## 📄 Licencia

MIT License - ver archivo LICENSE para detalles.

## 🆘 Soporte

Para soporte técnico o preguntas:
- Email: brianbauma10@gmail.com
- Documentación: [docs.supabase.com](https://docs.supabase.com)

---

**Desarrollado con ❤️ por Brian Bautista para Solucions Socials** 