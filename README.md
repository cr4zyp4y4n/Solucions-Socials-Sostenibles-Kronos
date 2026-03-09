# SSS Kronos

**Aplicación de escritorio** para la gestión administrativa de **Solucions Socials** y **Menjar d'Hort**: facturas, análisis, fichajes, subvenciones, socios, hojas de ruta y más. Todo en una sola app, conectada a Holded y Supabase.

---

## Qué es SSS Kronos

Centraliza en un solo sitio la operativa del día a día: análisis de facturas (compras y ventas) con vistas por canal y por proveedor, exportaciones Excel con verificación de IBAN, sistema de fichaje con cumplimiento normativa laboral, vacaciones y bajas, portal web para inspección, gestión de socios IDONI, hojas de ruta de catering, subvenciones, tienda y configuración. Pensada para equipos de administración y gestión que necesitan control y trazabilidad sin cambiar de herramienta.

---

## Módulos principales

| Área | Descripción |
|------|-------------|
| **Análisis** | Facturas de compra/venta desde Holded (Solucions y Menjar). Vistas General, Sergi (por canales) y Bruno (por proveedor/cliente). Filtro por año, exportación Excel con verificación IBAN y confirmación humana. |
| **Fichajes** | Registro de entrada/salida, pausas obligatorias, hora del servidor (Europe/Madrid). Panel por empleado con vacaciones, bajas y edición. Portal web para inspección. Ubicación al fichar y historial con auditoría. |
| **Subvenciones** | Fases de proyecto, abonos y saldos para EI SSS y Menjar d'Hort. Importación CSV, filtros y comentarios. |
| **Socios IDONI** | Carnets, importación CSV, CRUD y búsqueda. Campos DNI y teléfono. |
| **Hojas de ruta** | Catering: personal, checklist, histórico y carga de Excel/CSV. |
| **Gestión Tienda** | Hojas técnicas de platos y confirmación de productos por hoja de ruta. |
| **Admin** | Usuarios, roles (admin, manager, management, user), eliminación en cascada y actualizaciones. |

---

## Tecnología

- **Electron** + **React** (escritorio Windows).
- **Supabase**: auth, base de datos, storage.
- **Holded API**: facturas de compra/venta, contactos, empleados.
- **Portal de fichajes**: React desplegado en Netlify (solo lectura para inspección).

---

## Instalación

1. Descarga el instalador desde [Releases](https://github.com/cr4zyp4y4n/Solucions-Socials-Sostenibles-Kronos/releases) (`SSS Kronos-X.X.XX Setup.exe`).
2. Ejecuta el instalador y sigue los pasos.
3. Abre la app, crea cuenta con email corporativo y asigna rol si eres admin.

**Requisitos:** Windows 10/11 (64-bit), 4 GB RAM, conexión a internet.

---

## Actualizaciones

La app comprueba actualizaciones al iniciar. Para comprobar manualmente: **Configuración > Actualizaciones > Verificar Actualizaciones**. Admin, manager y management pueden instalar; el resto puede ver y descargar según configuración.

---

## Changelog y documentación

- **[CHANGELOG.md](CHANGELOG.md)** — Cambios por versión. Úsalo para copiar la descripción en cada release de GitHub y para ver qué se ha ido añadiendo o corrigiendo.
- **Documentación técnica:** carpeta `docs/` (guías y troubleshooting).
- **Scripts SQL:** carpeta `database/` (Supabase: fichajes, vacaciones, bajas, auth, etc.).
- **Gestión Tienda:** [docs/GESTION_TIENDA.md](docs/GESTION_TIENDA.md).
- **Panel de Fichajes:** [docs/PANEL_FICHAJES.md](docs/PANEL_FICHAJES.md).

---

## Build (desarrolladores)

```bash
npm install
npm run build
```

El instalador Windows se genera en `out/make/squirrel.windows/x64/`. En `forge.config.js` solo están configurados Squirrel (Windows) y zip (darwin); si necesitas DMG/deb/rpm, instala los makers correspondientes y añádelos de nuevo.

---

## Soporte

- **Email:** brianbauma10@gmail.com  
- **Issues:** sección de problemas del repositorio  

---

**Desarrollado por Brian Bautista para Solucions Socials.**  
Licencia MIT — ver [LICENSE](LICENSE).
