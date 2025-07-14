# Administració Management App

**Versión:** v1.0.3  

---

## 📦 Descripción

Aplicación de gestión administrativa para equipos y empresas, desarrollada con Electron, React y Supabase. Permite la gestión de usuarios, proveedores, facturas, archivos Excel y notificaciones en tiempo real, con un sistema robusto de roles y seguridad.

---

## 🚀 Características principales

- **Gestión de usuarios** con roles (`admin`, `manager`, `management`, `user`)
- **Eliminación en cascada**: al borrar un usuario, se eliminan todas sus referencias en la base de datos (logs, notificaciones, archivos, facturas, etc.)
- **Limpieza automática de usuarios fantasma** y referencias huérfanas
- **Gestión de proveedores y facturas**
- **Carga y procesamiento de archivos Excel**
- **Notificaciones en tiempo real**
- **Auditoría y logs de acciones**
- **Interfaz moderna, profesional y minimalista**
- **Soporte para Supabase, Node.js y MySQL**

---

## 🛠️ Instalación y ejecución

1. **Clona el repositorio:**
   ```bash
   git clone https://github.com/tuusuario/administracio-management-app.git
   cd administracio-management-app/seleccion-proveedores
   ```
2. **Instala las dependencias:**
   ```bash
   npm install
   ```
3. **Configura Supabase:**
   - Renombra `src/config/supabase.example.js` a `supabase.js` y añade tus claves.
   - Consulta la documentación en `/docs` para detalles de setup.
4. **Ejecuta la app en desarrollo:**
   ```bash
   npm start
   ```
5. **Genera el instalador (release):**
   ```bash
   npm run build
   ```
   El instalador se generará en la carpeta `/out`.

---

## 🆕 Notas de la versión v1.0.3

- **Eliminación en cascada profesional:**
  - Al eliminar un usuario, se eliminan automáticamente todas sus referencias en:
    - `audit_logs` (acciones)
    - `notifications` (como emisor y receptor)
    - `excel_uploads` (archivos subidos)
    - `invoices` (facturas creadas)
    - `user_profiles` y `auth.users` (perfil y autenticación)
- **Limpieza de usuarios fantasma:**
  - Scripts SQL para eliminar usuarios huérfanos y mantener la base de datos limpia.
- **Depuración y limpieza de código:**
  - Eliminados todos los logs de debugging y mensajes de consola.
- **Documentación y scripts SQL:**
  - Añadidos en `/database` y `/docs` para mantenimiento futuro.
- **Mejoras de seguridad y consistencia:**
  - Integridad referencial garantizada en todas las operaciones de usuario.

---

## 📚 Documentación

- Consulta la carpeta `/docs` para guías de instalación, troubleshooting y detalles técnicos.
- Scripts SQL útiles en `/database` para mantenimiento y limpieza avanzada.

---

## 🤝 Contribución

¿Quieres colaborar? Haz un fork, crea una rama y envía tu pull request. ¡Toda mejora es bienvenida!

---

## 📝 Licencia

MIT License

---

## 📬 Contacto

¿Dudas, sugerencias o incidencias?  
**Email:** tuemail@ejemplo.com  
**GitHub:** [tuusuario](https://github.com/tuusuario)

---

**¡Gracias por usar Administració Management App!** 