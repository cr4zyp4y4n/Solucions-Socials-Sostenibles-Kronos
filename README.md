# SSS Kronos - Sistema de Gestión de Proveedores

<div align="center">
  <img src="src/assets/Logo Minimalist SSS Highest Opacity.PNG" alt="SSS Kronos Logo" width="200"/>
  <br/>
  <em>Sistema moderno de gestión de proveedores y análisis de facturas para Solucions Socials</em>
</div>

---

## 📖 ¿Qué es SSS Kronos?

**SSS Kronos** es una aplicación de escritorio desarrollada específicamente para **Solucions Socials** que automatiza y optimiza la gestión de proveedores y el análisis de facturas.

### 🎯 **Problema que Resuelve**

Antes de SSS Kronos, el proceso de gestión de proveedores era manual y tedioso:
- ❌ Análisis manual de facturas en Excel
- ❌ Cálculos repetitivos de estadísticas
- ❌ Dificultad para identificar patrones de gastos
- ❌ Falta de visibilidad en tiempo real
- ❌ Procesos lentos de reportes

### ✅ **Solución que Ofrece**

SSS Kronos transforma completamente el flujo de trabajo:
- ✅ **Subida automática** de archivos Excel de facturas
- ✅ **Procesamiento inteligente** de datos con mapeo automático
- ✅ **Análisis en tiempo real** con gráficos y estadísticas
- ✅ **Dashboard ejecutivo** para jefes y administradores
- ✅ **Sistema de roles** para diferentes niveles de acceso
- ✅ **Notificaciones automáticas** de nuevos datos

---

## 🚀 Características Principales

### 📊 **Análisis Inteligente**
- **Estadísticas automáticas** de facturas y proveedores
- **Gráficos interactivos** de gastos por período
- **Análisis de tendencias** y patrones de pago
- **Filtros avanzados** por fecha, proveedor y tipo

### 👥 **Sistema de Roles**
- **👑 Administradores**: Acceso completo y gestión de usuarios
- **👔 Jefes**: Dashboard ejecutivo con vista general
- **👤 Gestión**: Subida de archivos y análisis de su equipo
- **👷 Usuarios**: Acceso básico a sus propios datos

### 📁 **Gestión de Archivos**
- **Subida directa** de archivos Excel de Solucions y Menjar d'Hort
- **Procesamiento automático** con validación de datos
- **Almacenamiento seguro** en la nube con Supabase
- **Historial completo** de archivos subidos

### 🎨 **Interfaz Moderna**
- **Diseño minimalista** con colores de marca IDONI
- **Tema claro/oscuro** automático
- **Animaciones suaves** y transiciones elegantes
- **Responsive** y optimizada para diferentes pantallas

---

## 📋 Requisitos del Sistema

### 💻 **Sistema Operativo**
- ✅ **Windows 10/11** (64-bit)
- ✅ **macOS 10.15+** (Catalina o superior)
- ✅ **Linux** (Ubuntu 18.04+, Debian 10+)

### 🔧 **Especificaciones Mínimas**
- **RAM**: 4 GB
- **Almacenamiento**: 500 MB libres
- **Procesador**: Intel/AMD de 2 GHz o superior
- **Conexión**: Internet para sincronización

---

## 🛠️ Instalación

### 📥 **Descargar desde Releases**

1. **Ve a la sección Releases** de este repositorio
2. **Selecciona la versión más reciente**
3. **Descarga el instalador** para tu sistema operativo:
   - Windows: `SSS-Kronos-Setup-x.x.x.exe`
   - macOS: `SSS-Kronos-x.x.x.dmg`
   - Linux: `SSS-Kronos-x.x.x.AppImage`

### ⚡ **Instalación Rápida**

#### **Windows**
1. Ejecuta el archivo `.exe` descargado
2. Sigue el asistente de instalación
3. La aplicación se instalará automáticamente
4. Busca "SSS Kronos" en el menú de inicio

#### **macOS**
1. Abre el archivo `.dmg` descargado
2. Arrastra SSS Kronos a la carpeta Aplicaciones
3. Ejecuta la aplicación desde Aplicaciones
4. Confirma la instalación si macOS lo solicita

#### **Linux**
1. Dale permisos de ejecución al archivo `.AppImage`:
   ```bash
   chmod +x SSS-Kronos-x.x.x.AppImage
   ```
2. Ejecuta el archivo:
   ```bash
   ./SSS-Kronos-x.x.x.AppImage
   ```

---

## 🚀 Primeros Pasos

### 1️⃣ **Primera Ejecución**
1. Abre SSS Kronos desde el menú de inicio
2. La aplicación se iniciará con una pantalla de carga
3. Verás la pantalla de login

### 2️⃣ **Crear tu Cuenta**
1. Haz clic en "Crear cuenta"
2. Introduce tu email corporativo
3. Establece una contraseña segura
4. Completa tu perfil con nombre y rol

### 3️⃣ **Configuración Inicial**
1. **Administradores**: Configura el sistema y crea usuarios
2. **Jefes**: Accede al dashboard ejecutivo
3. **Gestión**: Comienza a subir archivos Excel
4. **Usuarios**: Explora las funcionalidades básicas

---

## 📊 Cómo Usar SSS Kronos

### 📁 **Subir Archivos Excel**

1. **Ve a la página de Inicio**
2. **Haz clic en "Subir archivo"**
3. **Selecciona tu archivo Excel** (Solucions o Menjar d'Hort)
4. **Confirma la subida** y espera el procesamiento
5. **Verifica los datos** en la sección de análisis

### 📈 **Ver Análisis**

1. **Accede a la página "Análisis"**
2. **Explora las estadísticas** en tiempo real
3. **Usa los filtros** para ver datos específicos
4. **Exporta reportes** si es necesario

### 👥 **Gestión de Usuarios** (Solo Administradores)

1. **Ve a "Configuración"**
2. **Selecciona "Gestión de Usuarios"**
3. **Crea nuevos usuarios** o modifica roles existentes
4. **Configura permisos** según las necesidades

---

## 🔧 Configuración Avanzada

### 🗄️ **Base de Datos**
SSS Kronos utiliza **Supabase** como backend. La configuración incluye:
- Base de datos PostgreSQL en la nube
- Autenticación segura con JWT
- Almacenamiento de archivos en la nube
- Políticas de seguridad (RLS) habilitadas

### 🔐 **Seguridad**
- **Autenticación multifactor** disponible
- **Encriptación de datos** en tránsito y reposo
- **Políticas de acceso** basadas en roles
- **Auditoría completa** de acciones

### 📊 **Sincronización**
- **Datos en tiempo real** entre usuarios
- **Notificaciones automáticas** de nuevos archivos
- **Backup automático** de datos importantes
- **Historial de cambios** completo

---

## 🆘 Soporte y Ayuda

### 📚 **Documentación Técnica**
Para desarrolladores y configuración avanzada:
- **[Documentación completa](./docs/README.md)**
- **[Configuración de Supabase](./docs/SETUP_SUPABASE.md)**
- **[Solución de problemas](./docs/TROUBLESHOOTING.md)**

### 📧 **Contacto**
- **Email**: brianbauma10@gmail.com
- **Soporte técnico**: Disponible en horario laboral
- **Documentación**: [docs.supabase.com](https://docs.supabase.com)

### 🐛 **Reportar Problemas**
1. Ve a la sección "Issues" de este repositorio
2. Crea un nuevo issue con detalles del problema
3. Incluye capturas de pantalla si es posible
4. Describe los pasos para reproducir el error

---

## 🔄 Actualizaciones

### 📦 **Actualizaciones Automáticas**
- SSS Kronos se actualiza automáticamente
- Las nuevas versiones se descargan en segundo plano
- Se notifica cuando hay actualizaciones disponibles

### 📋 **Historial de Versiones**
- **v1.0.0**: Lanzamiento inicial con funcionalidades básicas
- **v1.1.0**: Mejoras en análisis y dashboard
- **v1.2.0**: Sistema de notificaciones y roles avanzados
- **Próximamente**: Módulos ERP/CRM adicionales


# Generar instalador
npm run build
```

---

## 📄 Licencia

Este proyecto está bajo la licencia **MIT**. Ver el archivo [LICENSE](./LICENSE) para más detalles.

---

<div align="center">
  <strong>Desarrollado con ❤️ por Brian Bautista para Solucions Socials</strong>
</div> 