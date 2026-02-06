# SSS Kronos v2.1.19


🚀 **Release Notes - SSS Kronos v2.1.19**

## 📦 Archivos de Distribución

### Windows
- **Instalador:** SSS Kronos-2.1.19 Setup.exe (130 MB aprox.)
- **Ubicación:** `out/make/squirrel.windows/x64/`
- **Compatibilidad:** Windows 10/11 (64-bit)

### Otros Sistemas Operativos
*Nota: Los instaladores para macOS y Linux se generarán en futuras versiones*

## ✨ Nuevas Características y Cambios Clave

### 🆕 **v2.1.19 - Gestión Tienda y dependencias PDF**
- ✅ **Página Gestión Tienda:** Nueva sección con dos pestañas: **Hojas Técnicas** y **Confirmación Productos Tienda** (ruta `/gestion-tienda`, roles: admin, manager, tienda).
- ✅ **Hojas Técnicas:** CRUD de fichas técnicas de platos (nombre, imagen, ingredientes con peso/coste/gastos, alérgenos), almacenamiento en Supabase y bucket `dish-images`, exportación a PDF con logo IDONI.
- ✅ **Confirmación Productos Tienda:** Listado de productos IDONI/BONCOR por hoja de ruta con filtros por estado (pendientes, disponibles, no disponibles) y estadísticas.
- ✅ **Dependencias PDF:** Generación de PDF con `jspdf` y `jspdf-autotable`; corrección de error de compilación "Module not found" instalando/verificando dependencias (`npm install jspdf jspdf-autotable` o `npm install`).
- ✅ **Panel de Fichajes:** Documentación del módulo Panel de Fichajes (resumen por empleado, estado en tiempo real) y enlace **"Abrir Panel Fichajes"** desde Admin > Fichajes para ir directamente a `/panel-fichajes`.
- 📄 **Documentación:** [docs/GESTION_TIENDA.md](docs/GESTION_TIENDA.md), [docs/PANEL_FICHAJES.md](docs/PANEL_FICHAJES.md).

### 🆕 **v2.1.18 - Facturas de venta Holded, Socios (DNI/teléfono) y mejoras**
- ✅ **Facturas de venta en Análisis:** Nueva sección idéntica a facturas de compra con toggle "Facturas de compra" / "Facturas de venta", mismo selector de año y vistas (General, Sergi, Bruno)
- ✅ **API Holded ventas:** Integración con `documents/invoice` para facturas de venta pendientes y vencidas (Solucions y Menjar)
- ✅ **Vista Bruno para ventas:** Textos adaptados (Cliente, Pendiente de cobro, Análisis de cobros por cliente, Detalle por Cliente, etc.) en lugar de terminología de proveedores/deuda
- ✅ **Exportación Excel (Sergi y Bruno):** Etiquetas condicionales según tipo; en ventas: columna Cliente, Pendiente de cobro, hoja "Facturas por Cliente", "TOTAL PENDIENTE DE COBRO"
- ✅ **Animación Inicio:** Transición (fade) al cambiar entre Facturas de compra y Facturas de venta en ambas direcciones
- ✅ **Socios IDONI - DNI y teléfono:** Nuevos campos en BD, importación CSV (columnas DNI y MOVIL), visualización y edición en lista, formularios y modal; búsqueda por DNI y teléfono
- ✅ **Socios - Fechas de registro:** Corrección de visualización de `socio_desde`; parseo como fecha local para evitar mostrar el día anterior por zona horaria UTC
- ✅ **Utilidades de fecha:** `formatDateOnlyLocal`, `parseDateOnlyAsLocal` y `getYearFromDateOnly` en `timeUtils.js` para fechas solo-día sin desplazamiento

### 🆕 **v2.1.16 - Filtrado por Año en Analytics y Mejoras en Exportación Excel**
- ✅ **Filtrado por año en Analytics:** Selector de año para visualizar facturas de 2025, 2026 o cualquier año disponible
- ✅ **Carga de facturas históricas:** Sistema mejorado que obtiene facturas de múltiples años (2025 y 2026) combinando resultados
- ✅ **Formato de fechas corregido:** Cambio de YYYY-MM-DD a timestamps Unix para compatibilidad con API de Holded
- ✅ **Logs de depuración extensivos:** Sistema completo de logging para diagnóstico de peticiones a Holded API
- ✅ **Optimización de consultas:** Consultas específicas por año en lugar de sin filtro para obtener todas las facturas históricas
- ✅ **Hojas de resumen Excel optimizadas:** Eliminado "Total" de hojas de resumen, mostrando solo "Pendiente" (lo que realmente se debe pagar)
- ✅ **Mantenimiento de hojas individuales:** Las hojas con facturas individuales mantienen columnas "Total" y "Pendiente" para referencia completa
- ✅ **Mejora en paginación:** Sistema mejorado para continuar cargando páginas aunque algunas estén vacías
- ✅ **Años disponibles dinámicos:** El selector de años se genera automáticamente basándose en los datos cargados

### 🆕 **v2.1.15 - Mejoras en Análisis IDONI: Productos y Visualización**
- ✅ **Carga completa de datos IDONI:** Paginación implementada para cargar todos los registros de ventas diarias (más de 1000 registros)
- ✅ **12 meses completos:** Corregido problema donde solo se mostraban 9 meses en gráficos y totales
- ✅ **Detección automática de productos a peso:** Sistema inteligente que distingue productos vendidos por kg vs unidades
- ✅ **Visualización diferenciada:** Productos a peso muestran "kg" automáticamente en tablas y gráficos
- ✅ **Gráficos separados de productos:** Tres gráficos independientes: Top por Importe, Top por Cantidad Unitaria, Top por Cantidad Kg
- ✅ **Selector de gráficos:** Dropdown para elegir qué tipo de gráfico visualizar
- ✅ **Selector de cantidad de productos:** Opción para mostrar Top 10, 20, 30 o 50 productos
- ✅ **Orden cronológico correcto:** Gráfico de "Ventas por Días de la Semana" ahora muestra meses de enero a diciembre (antes era al revés)
- ✅ **Totales precisos:** Cálculo correcto de totales generales incluyendo todos los meses disponibles
- ✅ **Mejora en visualización:** Gráficos con mayor altura (400px) para mejor visualización de más productos

### 🆕 **v2.1.14 - Sistema de Fichaje, Navegación Mejorada y Exportación Excel**
- ✅ **Sistema completo de fichaje:** Nueva sección para registro de entrada/salida de empleados con cumplimiento normativa laboral española
- ✅ **Gestión de pausas:** Registro obligatorio de pausas de comida y descansos según normativa
- ✅ **Panel de administración:** Vista completa de fichajes con filtros, edición y exportación CSV/PDF
- ✅ **Notificaciones de cambios:** Sistema de notificaciones cuando se modifican fichajes, con validación del trabajador
- ✅ **Auditoría completa:** Registro de todos los cambios con historial completo (retención 4 años)
- ✅ **Zona horaria correcta:** Migración a TIMESTAMPTZ para manejo preciso de horas con conversión automática a hora de España
- ✅ **Hora del servidor:** Todos los fichajes usan hora del servidor (UTC) para prevenir manipulación
- ✅ **Hoja de resumen en Excel:** Nueva hoja "Resumen" en exportaciones de Sergi y Bruno con totales de facturas
- ✅ **Selector de hojas en header:** Dropdown rápido para cambiar entre hojas de ruta activas sin abrir el histórico
- ✅ **Botón "Cargar" en histórico:** Nueva opción para seleccionar y cargar cualquier hoja del histórico como hoja actual
- ✅ **Navegación mejorada:** Posibilidad de cambiar entre múltiples hojas de ruta activas (útil para múltiples caterings simultáneos)
- ✅ **Corrección de bucle infinito:** Solucionado problema donde al verificar una hoja y subir otra nueva se generaba un bucle
- ✅ **Gestión de estado optimizada:** Uso de `useRef` para prevenir actualizaciones redundantes y bucles de renderizado
- ✅ **Comportamiento por defecto mantenido:** La última hoja subida sigue mostrándose automáticamente al entrar a la sección
- ✅ **Visualización de hoja actual:** Selector muestra claramente qué hoja está activa con indicador visual
- ✅ **Filtrado inteligente:** Selector excluye automáticamente la hoja actual del listado para evitar duplicados
- ✅ **Acceso rápido al histórico completo:** Botón en el selector para abrir el modal completo del histórico

### 🆕 **v2.1.13 - Mejoras en Análisis IDONI y Experiencia de Usuario**
- ✅ **Análisis detallado por día de la semana:** Nueva sección en IDONI para filtrar ventas por día de la semana y mes/año específico
- ✅ **Tabla de análisis temporal:** Visualización detallada de ventas filtradas con orden cronológico (más antiguo primero)
- ✅ **Agrupación automática de datos:** Registros duplicados del mismo día y tienda se agrupan automáticamente, sumando ventas y tickets
- ✅ **Corrección de días de la semana:** Solucionado problema donde los días aparecían desplazados (domingos como lunes) en gráficos y tablas
- ✅ **Cálculo preciso de días:** Los días de la semana se calculan directamente desde la fecha para evitar errores de zona horaria
- ✅ **Bloqueo de botones durante carga:** Los botones de selección de dataset (Solucions, Menjar, IDONI) se bloquean mientras se cargan datos de Holded
- ✅ **Spinner de carga para IDONI:** Reemplazado mensaje de texto por spinner animado con texto explicativo durante la carga
- ✅ **Alineación consistente:** Spinners de carga alineados verticalmente en todas las secciones
- ✅ **Prevención de clics durante carga:** Interfaz bloqueada para evitar problemas al cambiar de dataset mientras carga
- ✅ **Mejora en UX de carga:** Usuario recibe feedback visual claro del estado de carga con mensajes informativos

### 🆕 **v2.1.12 - Verificación de Listas y Material, Selección de Facturas para Exportación**
- ✅ **Sistema de verificación de listas y material:** Firma convertida a texto para verificación de checklists, material y equipamiento
- ✅ **Verificación por nombre:** El usuario escribe su nombre completo para confirmar la verificación
- ✅ **Indicador de verificación en checklist:** Muestra quién verificó las listas y cuándo
- ✅ **Separación de responsabilidades:** Verificación de listas separada del responsable del servicio
- ✅ **Selección de facturas para exportación:** Sistema de checkboxes para elegir qué facturas incluir en Excel
- ✅ **Selecciones independientes:** Bruno y Sergi tienen selecciones independientes de facturas
- ✅ **Botones de sincronización:** Opción para copiar selecciones entre vistas Bruno y Sergi
- ✅ **Botones de reset:** Volver a seleccionar todas las facturas con un solo clic
- ✅ **Pantalla de carga en análisis:** Indicador de carga dentro de la sección mientras se cargan las tablas
- ✅ **Corrección de datos Bruno:** Solucionados problemas de valores "infinity" y datos incorrectos
- ✅ **IBANs correctos:** Vista Bruno ahora muestra IBANs correctos usando datos enriquecidos de Holded
- ✅ **Totales precisos:** Cálculos de totales corregidos usando datos consistentes entre vistas
- ✅ **Validación numérica robusta:** Manejo de valores no numéricos e infinitos en cálculos
- ✅ **UI mejorada:** Facturas no seleccionadas aparecen con opacidad reducida para mejor visualización

### 🆕 **v2.1.12 - Sistema de Verificación de Listas y Material en Hojas de Ruta**
- ✅ **Verificación por nombre:** Sistema de verificación convertido de firma digital a texto (nombre completo)
- ✅ **Confirmación de listas y material:** El usuario escribe su nombre para confirmar verificación de checklists, material y equipamiento
- ✅ **Indicador visual en checklist:** Muestra quién verificó las listas y cuándo se realizó la verificación
- ✅ **Separación de responsabilidades:** Verificación de listas separada del responsable del servicio
- ✅ **Texto actualizado:** Todos los textos relacionados actualizados para reflejar "verificación de listas y material"
- ✅ **Visualización mejorada:** Muestra "Verificado por [Nombre]" en lugar de imagen de firma
- ✅ **Prevención de cambios:** Una vez verificada, la verificación no se puede modificar

### 🆕 **v2.1.7 - Hojas de Ruta en Supabase, Historial y Permisos**
- ✅ **Base de datos Hojas de Ruta (Supabase):** Tablas creadas para hojas, personal asignado, checklist y relaciones.
- ✅ **Índice único corregido:** `COALESCE` movido a `CREATE UNIQUE INDEX` para evitar error 42601.
- ✅ **RLS revisado:** Políticas actualizadas y archivo `rls_policies_hojas_ruta_FIXED.sql` con `DROP POLICY IF EXISTS` y referencias correctas a `hojas_ruta_personal`.
- ✅ **Servicio Supabase nuevo:** `hojaRutaSupabaseService.js` con métodos para crear, obtener, firmar, checklist, histórico y subida de CSV/Excel.
- ✅ **Parsing CSV/Excel robusto:** `processCSVStandard` como vía principal y parser flexible como fallback; mejoras en fechas y cliente por defecto (usa nombre de archivo o "Cliente sin nombre").
- ✅ **Historial de servicios del empleado:** JOIN corregido; muestra servicios y horas reales desde `hojas_ruta_personal`.
- ✅ **UI Empleados/Modal:** Eliminados "Promedio/Servicio" y "Completados". Se mantienen solo **Total Servicios** y **Total Horas**.
- ✅ **Navegación cruzada:**
  - Desde Empleados: clic en servicio abre la **Hoja de Ruta** específica.
  - Desde Hoja de Ruta (modal empleado): botón **"Ver en Empleados"** abre la sección mostrando ese empleado.
- ✅ **Animaciones consistentes:** Unificadas en Empleados y Hoja de Ruta; eliminada animación de giro del header en Hoja de Ruta.
- ✅ **Control de horas por rol (RBAC):** Solo `jefe`/`admin`/`administrador` ven y editan horas; usuarios normales no ven horas en ninguna sección.
- ✅ **Fuente del rol correcta:** Permisos basados en `user_profiles.role` (no `user.role`).
- ✅ **Correcciones clave:**
  - Cierre JSX incorrecto (`</motion.div>` vs `</div>`) que causaba build cascade y error de inicialización.
  - Eliminado error "Cannot access 'loadDatos' before initialization".
  - Header sin rotaciones "barrel roll".

### 🆕 **v2.1.6 - Carnets de Socio Interactivos y Gestión Completa**
- ✅ **Nueva sección Socios IDONI:** Gestión completa de socios de la agrobotiga
- ✅ **Carnets interactivos:** Visualización de carnets con ambas caras y animación 3D
- ✅ **Importación desde CSV:** Carga masiva de socios con fechas originales preservadas
- ✅ **Impresión directa:** Botón para imprimir carnets con datos ya rellenados
- ✅ **Descarga de imágenes:** Generación de imágenes PNG de alta calidad para impresión
- ✅ **Base de datos Supabase:** Almacenamiento seguro con IDs únicos de 5 dígitos
- ✅ **Gestión CRUD completa:** Crear, editar, eliminar y buscar socios
- ✅ **Modal de confirmación personalizado:** Reemplazo del confirm() nativo por diseño consistente
- ✅ **Lista moderna:** Estilo continuo sin scroll interno, igual que la sección de empleados
- ✅ **Filtros y búsqueda:** Sistema de búsqueda avanzado con estadísticas en tiempo real
- ✅ **Roles y permisos:** Control de acceso basado en roles de usuario
- ✅ **Diseño fiel:** Carnets usando imágenes SVG originales con texto superpuesto
- ✅ **Animaciones suaves:** Efectos de giro 3D y transiciones profesionales

### 🎫 **Sistema de Carnets de Socio (v2.1.6)**
- ✅ **Diseño profesional:** Carnets usando imágenes SVG originales de IDONI BonCor
- ✅ **Datos dinámicos:** Nombre, apellido y número de socio superpuestos automáticamente
- ✅ **Doble cara:** Frente con datos personales y reverso con beneficios y promociones
- ✅ **Animación 3D:** Efecto de giro suave entre ambas caras del carnet
- ✅ **Impresión optimizada:** CSS específico para impresión con ambas caras en una página
- ✅ **Descarga de imagen:** Generación de PNG de alta calidad para impresión profesional
- ✅ **Posicionamiento preciso:** Texto superpuesto en las posiciones exactas del diseño original
- ✅ **Controles intuitivos:** Botones para girar, imprimir, descargar y cerrar
- ✅ **Responsive:** Adaptable a diferentes tamaños de pantalla

### 🆕 **v2.1.5 - Sección de Empleados y Mejoras en Subvenciones**
- ✅ **Nueva sección de Empleados:** Gestión completa de empleados desde Holded API
- ✅ **Integración Holded Team API:** Consulta directa de datos de empleados de ambas empresas
- ✅ **Export para Subvención L2:** Generación automática de Excel con formato específico para subvenciones
- ✅ **Selector de entidad mejorado:** Interfaz consistente entre Subvenciones y Empleados
- ✅ **Modal de detalles completo:** Visualización de toda la información laboral y personal
- ✅ **Filtros avanzados:** Búsqueda por nombre, email, DNI, puesto y filtro por estado
- ✅ **Estadísticas en tiempo real:** Contadores de empleados activos, inactivos y departamentos
- ✅ **Spinner minimalista:** Indicador de carga consistente con el resto de la aplicación
- ✅ **Modo oscuro/claro:** Soporte completo para ambos temas
- ✅ **Campos para subvenciones:** Preparación de datos específicos para gestiones de subvenciones

### 🆕 **v2.1.4 - Sistema de Subvenciones Multi-Entidad y Panel de Administración**
- ✅ **Sistema de entidades múltiples:** Soporte para EI SSS SCCL y Menjar d'Hort SCCL
- ✅ **Panel de administración completo:** Gestión avanzada de usuarios con control total
- ✅ **Onboarding actualizado:** Guía completa de todas las funcionalidades con advertencia BETA
- ✅ **Gestión de fases mejorada:** Sistema de edición intuitivo para ambas entidades
- ✅ **Corrección de errores críticos:** Solucionados problemas de RLS y sincronización de datos
- ✅ **Interfaz de selección de entidad:** Botones estilo Analytics para cambiar entre entidades
- ✅ **Cálculos financieros precisos:** Saldos pendientes y totales corregidos
- ✅ **Soporte CSV horizontal:** Procesamiento de archivos CSV en formato horizontal (Menjar d'Hort)

### 🔧 **Mejoras en Sección de Subvenciones (v2.1.5)**
- ✅ **Filtros mejorados:** Layout corregido sin superposición de elementos
- ✅ **Filtros guardados:** Sistema de guardado y carga de filtros personalizados
- ✅ **Estadísticas dinámicas:** Totales que se actualizan con filtros aplicados
- ✅ **Etiquetas de estado mejoradas:** Colores distintivos y iconos para mejor identificación
- ✅ **Botón limpiar filtros inteligente:** Solo aparece cuando hay filtros activos
- ✅ **Chips de filtros activos:** Visualización clara de filtros aplicados con opción de eliminar
- ✅ **Filtro por año:** Nueva funcionalidad para filtrar subvenciones por año específico
- ✅ **Corrección de fases:** Manejo correcto de fases para ambas entidades (objeto vs string)

### 🆕 **v2.1.3 - Sistema de Subvenciones con Base de Datos**
- ✅ **Nueva sección de Subvenciones:** Gestión completa de subvenciones con interfaz moderna
- ✅ **Integración con Supabase:** Almacenamiento persistente de datos de subvenciones
- ✅ **Sistema de comentarios:** Añadir, editar y eliminar comentarios por subvención
- ✅ **Importación CSV:** Sincronización automática de datos CSV con la base de datos
- ✅ **Filtros avanzados:** Búsqueda por nombre, estado, imputación y fase del proyecto
- ✅ **Detección de fases:** Análisis inteligente de fases del proyecto con indicadores visuales
- ✅ **Temas claro/oscuro:** Soporte completo para ambos modos de visualización

### 🆕 **v2.1.2 - Optimización de Carga y Experiencia de Usuario**
- ✅ **Feedback visual mejorado:** Mensajes de carga dinámicos durante sincronización con Holded
- ✅ **Optimización de rendimiento:** Eliminación de logs verbosos que ralentizaban la carga
- ✅ **Texto actualizado:** Mensajes corregidos para reflejar integración con Holded (no Excel)
- ✅ **Carga más rápida:** Reducción significativa del tiempo de carga de datos
- ✅ **Mensajes informativos:** Usuario sabe exactamente qué está pasando durante la carga
- ✅ **Spinner mejorado:** Indicador de progreso con mensajes específicos por fase
- ✅ **Corrección de errores:** Solucionados errores de `setGeneralData` y `setBrunoData` no definidos

### 🆕 **v2.1.1 - Análisis Avanzado de Productos IDONI**
- ✅ **Tabla de productos por meses individuales:** Reemplazado sistema de trimestres por análisis mensual detallado
- ✅ **12 columnas mensuales:** Gener, Febrer, Març, Abril, Maig, Juny, Juliol, Agost, Setembre, Octubre, Novembre, Desembre
- ✅ **Gráficos optimizados:** Top 10 productos por importe y cantidad con etiquetas limpias (solo código)
- ✅ **Tooltips informativos:** Información completa del producto (código + descripción) al hacer hover
- ✅ **Scroll horizontal controlado:** Contenedor de tabla con ancho fijo (1150px) y scroll solo en la tabla
- ✅ **Optimización de espacio:** Padding y fuentes reducidas para columnas mensuales
- ✅ **Análisis granular:** Vista detallada de ventas por producto y mes individual

### 🔐 **Sistema de Control de Acceso Robusto (RBAC)**
- ✅ **Catering exclusivo:** Solo visible para administradores
- ✅ **Actualizaciones restringidas:** Solo administradores pueden gestionar actualizaciones
- ✅ **Mensajes de acceso denegado:** Interfaz clara para usuarios no autorizados
- ✅ **Permisos extendidos:** Rol "Usuario" tiene acceso a configuración y conexiones
- ✅ **Navegación inteligente:** Menú adaptativo según el rol del usuario

### 🗑️ **Sistema de Eliminación de Usuarios Mejorado**
- ✅ **Eliminación en cascada robusta:** Sin errores de foreign key constraints
- ✅ **Manejo de tablas relacionadas:** `catering_events`, `notifications`, `catering_staff`
- ✅ **Verificaciones de seguridad:** Comprobaciones `EXISTS` antes de eliminar
- ✅ **Función SQL optimizada:** `complete_delete_user_cascade` mejorada
- ✅ **Eliminación segura:** Sin afectar integridad de la base de datos

### 📊 **Exportación de Datos Avanzada (v2.1.12)**
- ✅ **Selección de facturas para exportación:** Sistema de checkboxes para elegir qué facturas incluir en Excel
- ✅ **Selecciones independientes:** Bruno y Sergi tienen selecciones independientes de facturas
- ✅ **Botones de sincronización:** Opción para copiar selecciones entre vistas Bruno y Sergi
- ✅ **Botones de reset:** Volver a seleccionar todas las facturas con un solo clic
- ✅ **Vista Sergi mejorada:** Descarga por canales con hojas separadas
- ✅ **Vista Bruno optimizada:** Todas las facturas en una hoja, agrupadas por proveedor
- ✅ **Inclusión de IBAN:** Para cada factura individual en exportaciones
- ✅ **Límites Excel manejados:** Nombres de hojas truncados a 31 caracteres
- ✅ **Totales precisos:** Calculados por canal y proveedor correctamente
- ✅ **Exportación filtrada:** Solo se exportan las facturas seleccionadas, manteniendo el formato original

### 💰 **Cálculos Financieros Precisos**
- ✅ **Montos pendientes:** En lugar de totales para facturas parcialmente pagadas
- ✅ **Nueva columna "Pendiente":** En vista Sergi con montos específicos
- ✅ **Vista Bruno actualizada:** Facturas individuales muestran montos pendientes
- ✅ **Totales correctos:** Reflejan realmente lo que falta por pagar
- ✅ **Consistencia en exportaciones:** Excel refleja exactamente las vistas en pantalla

### 🔍 **Integración Completa con Holded API**
- ✅ **Facturas parcialmente pagadas:** 5 facturas encontradas e integradas correctamente
- ✅ **Consultas específicas:** Para `paid=2` (parcialmente pagadas)
- ✅ **Deduplicación inteligente:** Combinación de resultados sin duplicados
- ✅ **Logs detallados:** Para diagnóstico y debugging avanzado
- ✅ **Función de prueba:** Botón específico para testear facturas parcialmente pagadas

### 👥 **Nueva Sección de Empleados (v2.1.5)**
- ✅ **Integración Holded Team API:** Consulta directa de empleados desde Holded
- ✅ **Dual empresa:** Soporte para EI SSS SCCL y Menjar d'Hort SCCL
- ✅ **Información completa:** Datos personales, laborales, bancarios y de contacto
- ✅ **Export para subvenciones:** Excel específico para gestiones de subvención L2
- ✅ **Modal de detalles:** Visualización completa de información por empleado
- ✅ **Filtros avanzados:** Búsqueda por múltiples criterios y filtro por estado
- ✅ **Estadísticas dinámicas:** Contadores en tiempo real de empleados activos/inactivos
- ✅ **Interfaz consistente:** Selector de entidad igual que Subvenciones
- ✅ **Campos específicos:** Preparación de datos para subvenciones (colectivo, jornada, etc.)

### 🎨 **Mejoras de Experiencia de Usuario**
- ✅ **Botones de analytics:** No aparecen hasta cargar datos completamente
- ✅ **Versión dinámica:** Configuración muestra versión actual del app automáticamente
- ✅ **Botón de prueba integrado:** Para facturas parcialmente pagadas en configuración
- ✅ **Columna "Monto":** En lugar de "Total" para mayor claridad
- ✅ **Interfaz responsiva:** Mejor manejo de estados de carga
- ✅ **Spinner minimalista:** Indicador de carga consistente en todas las secciones
- ✅ **Filtros sin superposición:** Layout mejorado para búsquedas y filtros

### 🏪 **Módulo IDONI - Análisis de Ventas de Tienda**
- ✅ **Carga de datos Excel:** Subida de archivos "Ventas Diarias" y "Ventas por Horas"
- ✅ **Almacenamiento en Supabase:** Persistencia de datos en tablas especializadas
- ✅ **Análisis avanzado:** Ventas mensuales, por días de la semana y por horas
- ✅ **Gráficos interactivos:** Visualización con Chart.js para mejor comprensión
- ✅ **Tarjetas de resumen:** Total ventas, tickets y media por ticket
- ✅ **Análisis de rendimiento:** Mejor/peor día, consistencia y crecimiento mensual
- ✅ **Tabla comparativa:** Análisis detallado por días de la semana
- ✅ **Filtrado inteligente:** Exclusión automática de filas "TOTAL" y datos problemáticos
- ✅ **Análisis de productos por meses:** Vista detallada de ventas por producto y mes individual
- ✅ **Tabla optimizada:** 12 columnas mensuales con scroll horizontal controlado
- ✅ **Gráficos de productos:** Top 10 por importe y cantidad con etiquetas limpias
- ✅ **Tooltips informativos:** Información completa del producto en hover

### 📊 **Mejoras en AnalyticsPage (v2.1.16)**
- ✅ **Filtrado por año:** Selector de año para filtrar facturas por año específico (2025, 2026, etc.)
- ✅ **Carga de múltiples años:** Sistema que carga facturas de 2025 y 2026 automáticamente cuando no hay filtro de año
- ✅ **Logs de depuración:** Sistema completo de logging que muestra peticiones a API, cantidad de facturas obtenidas, rangos de fechas y años encontrados
- ✅ **Optimización de consultas:** Consultas específicas por año en lugar de sin filtro para mejor rendimiento y resultados completos
- ✅ **Hojas de resumen Excel:** Eliminado "Total" de resúmenes, mostrando solo "Pendiente" (monto realmente a pagar)
- ✅ **Años disponibles dinámicos:** Selector de años se genera automáticamente basándose en los datos cargados

### 📊 **Mejoras en AnalyticsPage (v2.1.15)**
- ✅ **Carga completa de datos:** Paginación implementada para cargar todos los registros de ventas diarias (sin límite de 1000)
- ✅ **12 meses completos:** Corregido problema donde solo se mostraban 9 meses en gráficos y totales
- ✅ **Detección de productos a peso:** Sistema que identifica automáticamente productos vendidos por kg (valores con decimales) vs unidades (valores enteros)
- ✅ **Visualización diferenciada:** Productos a peso muestran "kg" en tablas y tooltips de gráficos
- ✅ **Gráficos separados:** Tres gráficos independientes con selector para elegir tipo (Importe, Cantidad Unitaria, Cantidad Kg)
- ✅ **Selector de cantidad:** Opción para mostrar Top 10, 20, 30 o 50 productos en los gráficos
- ✅ **Orden cronológico correcto:** Gráfico de días de la semana muestra meses de enero a diciembre (corregido orden inverso)
- ✅ **Totales precisos:** Cálculo correcto incluyendo todos los meses disponibles
- ✅ **Mejora visual:** Gráficos con mayor altura para mejor visualización de más productos

### 📊 **Mejoras en AnalyticsPage (v2.1.13)**
- ✅ **Análisis detallado por día de la semana:** Nueva sección en IDONI con filtros por día de la semana y mes/año
- ✅ **Agrupación inteligente de datos:** Registros duplicados del mismo día y tienda se agrupan automáticamente
- ✅ **Corrección de días de la semana:** Solucionado desplazamiento de días en gráficos y tablas de IDONI
- ✅ **Cálculo preciso desde fechas:** Días calculados directamente desde objetos Date para evitar errores de zona horaria
- ✅ **Bloqueo de interfaz durante carga:** Botones de selección bloqueados mientras se cargan datos de Holded
- ✅ **Spinner de carga mejorado:** Indicador visual con texto explicativo para IDONI durante la carga
- ✅ **Alineación consistente:** Spinners de carga alineados verticalmente en todas las secciones
- ✅ **Orden cronológico:** Tabla de análisis ordenada con fechas más antiguas primero
- ✅ **Totales agrupados:** Cálculo correcto de totales después de agrupar registros duplicados

### 📊 **Mejoras en AnalyticsPage (v2.1.12)**
- ✅ **Pantalla de carga integrada:** Indicador de carga dentro de la sección mientras se cargan las tablas
- ✅ **Mensajes de carga contextuales:** Usuario sabe exactamente qué datos se están cargando
- ✅ **Corrección de datos Bruno:** Solucionados problemas de valores "infinity" y datos incorrectos
- ✅ **IBANs correctos:** Vista Bruno ahora muestra IBANs correctos usando datos enriquecidos de Holded
- ✅ **Totales precisos:** Cálculos de totales corregidos usando datos consistentes entre vistas
- ✅ **Validación numérica robusta:** Manejo de valores no numéricos e infinitos en cálculos
- ✅ **Ordenación de fechas corregida:** Ahora ordena cronológicamente correctamente
- ✅ **Filtros independientes:** El filtro de mes en vista Sergi ya no afecta a otras vistas
- ✅ **Interfaz adaptativa:** Vista IDONI con interfaz específica sin vistas General/Sergi/Bruno
- ✅ **Tooltips personalizados:** Sin emojis, texto más grande y en negrita
- ✅ **Colores diferenciados:** Paleta de colores distintiva para cada día de la semana
- ✅ **Alineación profesional:** Tablas con alineación natural (izquierda para texto, derecha para números)

### 🔄 Sistema de Actualizaciones Automáticas
- ✅ **Verificación automática:** La app verifica actualizaciones al iniciar
- ✅ **Notificaciones automáticas:** Todos los usuarios reciben notificación cuando hay nueva versión
- ✅ **Descarga en segundo plano:** Actualizaciones se descargan automáticamente
- ✅ **Instalación con un clic:** Reinicio automático con la nueva versión
- ✅ **Integración con GitHub:** Distribución automática desde GitHub Releases
- ✅ **Verificación manual:** Botón en Configuración para verificar actualizaciones manualmente
- ✅ **Permisos inteligentes:** Administradores, jefes, managers y usuarios pueden instalar actualizaciones

### 🛡️ Mejoras de Seguridad y Estabilidad
- ✅ **Content Security Policy mejorada:** Permite conexiones seguras a GitHub API
- ✅ **Manejo robusto de errores:** Verificación de actualizaciones con fallback
- ✅ **Logs detallados:** Información de debug visible para todos los usuarios
- ✅ **Verificación de conectividad:** Pruebas de conexión antes de verificar actualizaciones

### 🎯 Gestión de Roles y Permisos
- ✅ **Permisos de actualización:** Admin, Management y Manager pueden instalar actualizaciones
- ✅ **Interfaz adaptativa:** Solo lectura para usuarios básicos
- ✅ **Notificaciones inteligentes:** Sistema de notificaciones integrado con Supabase

### 🕐 **Sistema de Fichaje Completo (v2.1.14)**
- ✅ **Registro de entrada/salida:** Fichaje diario con hora del servidor (UTC) para cumplimiento normativa
- ✅ **Gestión de pausas obligatorias:** Registro de pausas de comida y descansos según normativa laboral española
- ✅ **Panel de administración:** Vista completa con filtros por empleado, fecha y exportación CSV/PDF
- ✅ **Modificación de fichajes:** Administradores pueden modificar fichajes con motivo obligatorio y notificación al trabajador
- ✅ **Validación del trabajador:** Sistema de aceptación/rechazo de cambios realizados por la empresa
- ✅ **Auditoría completa:** Historial de todos los cambios con quién, cuándo y valores anteriores/nuevos
- ✅ **Añadir fichajes a posteriori:** Posibilidad de añadir fichajes olvidados con marcado especial
- ✅ **Resumen mensual:** Visualización de horas trabajadas, días completos/incompletos y totales
- ✅ **Detección automática de empleado:** Integración con Holded para detectar automáticamente el empleado del usuario
- ✅ **Zona horaria correcta:** Migración a TIMESTAMPTZ con conversión automática a hora de España (Europe/Madrid)
- ✅ **Prevención de manipulación:** Todos los timestamps usan hora del servidor, no del dispositivo del usuario
- ✅ **Interfaz moderna:** Diseño consistente con animaciones y feedback visual claro
- ✅ **Cumplimiento normativa:** Sistema diseñado según normativa laboral española con retención de 4 años

### 📋 **Mejoras en Hojas de Ruta (v2.1.14)**
- ✅ **Selector de hojas rápido:** Dropdown en el header que muestra la hoja actual y las últimas 15 hojas del histórico
- ✅ **Cambio rápido entre hojas:** Un solo clic para cambiar entre diferentes hojas de ruta activas
- ✅ **Botón "Cargar" en histórico:** Nueva funcionalidad para seleccionar cualquier hoja del histórico y cargarla como actual
- ✅ **Indicador visual de hoja actual:** La hoja activa se muestra con fondo destacado y check verde en el selector
- ✅ **Prevención de duplicados:** El selector filtra automáticamente la hoja actual del listado del histórico
- ✅ **Gestión de múltiples caterings:** Soporte para trabajar con múltiples hojas de ruta activas simultáneamente
- ✅ **Comportamiento inteligente:** La última hoja subida se muestra por defecto, pero se puede cambiar fácilmente
- ✅ **Recarga automática del histórico:** Al seleccionar una hoja, el histórico se actualiza automáticamente

### 📊 **Mejoras en Exportación Excel (v2.1.14)**
- ✅ **Hoja de resumen en Excel Sergi:** Nueva hoja "Resumen" con totales por canal y totales generales
- ✅ **Hoja de resumen en Excel Bruno:** Nueva hoja "Resumen" con totales por proveedor y totales generales
- ✅ **Totales detallados:** Incluye total general, total pendiente y número total de facturas
- ✅ **Formato profesional:** Columnas con ancho adecuado y valores numéricos para sumas automáticas en Excel

### 🐞 Correcciones de Errores

#### **v2.1.18 - Correcciones de Socios y Análisis**
- ✅ **Corregidas fechas de registro de socios:** `socio_desde` ya no se muestra un día antes por interpretación UTC; parseo como fecha local (YYYY-MM-DD)
- ✅ **Corregida animación Inicio Análisis:** Al cambiar de "Facturas de venta" a "Facturas de compra" ahora se muestra la misma transición (fade) que en el sentido contrario

#### **v2.1.16 - Correcciones de Filtrado por Año y API Holded**
- ✅ **Corregido problema de facturas de 2025:** Solucionado problema donde solo se mostraban facturas de 2026, ahora se obtienen correctamente facturas de 2025 y 2026
- ✅ **Corregido formato de fechas:** Cambio de formato YYYY-MM-DD a timestamps Unix para compatibilidad correcta con API de Holded
- ✅ **Corregido error 400 Bad Request:** Solucionados errores al hacer consultas con filtros de fecha incorrectos
- ✅ **Corregida estrategia de carga:** Cambio de consultas sin filtro (que solo devolvían facturas recientes) a consultas específicas por año
- ✅ **Corregida paginación:** Sistema mejorado que continúa cargando aunque haya páginas vacías consecutivas
- ✅ **Corregida función getOverduePurchases:** Ya no aplica filtro de fecha de hoy cuando year es null, obteniendo todas las facturas vencidas de cualquier año

#### **v2.1.15 - Correcciones de Análisis IDONI**
- ✅ **Corregida carga incompleta de datos:** Solucionado problema donde solo se cargaban los primeros 1000 registros de ventas diarias
- ✅ **Corregidos meses faltantes:** Ahora se muestran los 12 meses completos en gráficos y totales (antes solo 9)
- ✅ **Corregido orden de meses:** Gráfico de días de la semana ahora muestra meses de enero a diciembre (corregido orden inverso)
- ✅ **Corregidos totales incorrectos:** Cálculo de totales generales ahora incluye todos los meses disponibles
- ✅ **Corregida visualización de productos:** Productos a peso ahora muestran correctamente "kg" en lugar de unidades

#### **v2.1.14 - Correcciones de Fichaje y Zona Horaria**
- ✅ **Corregida zona horaria:** Migración completa de TIMESTAMP a TIMESTAMPTZ para manejo correcto de horas
- ✅ **Corregida visualización de horas:** Las horas ahora se muestran correctamente en zona horaria de España (Europe/Madrid)
- ✅ **Corregida interpretación de timestamps:** Strings sin timezone ahora se interpretan correctamente como UTC
- ✅ **Corregida función parseDateAsUTC:** Manejo correcto de timestamps sin indicador de zona horaria
- ✅ **Limpieza de código:** Eliminados todos los logs de debug y archivos SQL temporales
- ✅ **Optimización de funciones:** Código limpio y listo para producción sin funciones de prueba

#### **v2.1.14 - Correcciones de Hojas de Ruta**
- ✅ **Corregido bucle infinito:** Solucionado problema donde al verificar una hoja y subir otra nueva se generaba un bucle cambiando entre ambas
- ✅ **Corregida gestión de estado:** Uso de `useRef` para prevenir actualizaciones redundantes del checklist
- ✅ **Corregida carga de hojas:** `handleUploadSuccess` ahora solo recarga el histórico, no la hoja actual, evitando cambios inesperados
- ✅ **Corregida navegación:** Al seleccionar una hoja del histórico, se carga correctamente sin afectar otras hojas activas

#### **v2.1.13 - Correcciones de Análisis IDONI**
- ✅ **Corregido desplazamiento de días:** Los días de la semana ahora se calculan correctamente desde la fecha, evitando errores de zona horaria
- ✅ **Corregida visualización de días:** Gráficos y tablas muestran el día correcto del calendario
- ✅ **Corregida agrupación de datos:** Registros duplicados del mismo día y tienda ahora se agrupan correctamente
- ✅ **Corregido posicionamiento de spinner:** Spinner de carga de IDONI alineado con el de Solucions
- ✅ **Corregido bloqueo de interfaz:** Botones ahora se bloquean correctamente durante la carga de datos

#### **v2.1.12 - Correcciones de Análisis y Datos**
- ✅ **Corregido error "infinity" en vista Bruno:** Solucionados valores infinitos en totales y cálculos
- ✅ **Corregidos IBANs incorrectos:** Vista Bruno ahora usa datos enriquecidos de Holded con IBANs correctos
- ✅ **Corregidos totales incorrectos:** Cálculos de totales ahora usan datos consistentes entre vistas
- ✅ **Corregida validación numérica:** Manejo robusto de valores no numéricos e infinitos
- ✅ **Corregida pantalla de carga:** Ahora aparece correctamente dentro de la sección de análisis
- ✅ **Corregida sincronización de datos:** `baseData` y `brunoData` ahora usan la misma fuente de datos enriquecidos
- ✅ **Corregidos índices de columnas:** Uso de `columnIndices` en lugar de índices fijos para acceso a datos

#### **v2.1.4 - Correcciones Críticas de Sistema**
- ✅ **Corregido error de RLS infinito:** Solucionada recursión infinita en políticas de Supabase
- ✅ **Corregido error `fase1` undefined:** Manejo correcto de fases para Menjar d'Hort
- ✅ **Corregida sincronización de entidades:** Datos se muestran correctamente al cambiar entre entidades
- ✅ **Corregido modal de edición de fases:** Fases se marcan correctamente para ambas entidades
- ✅ **Corregidos cálculos de saldos:** Saldos pendientes calculados correctamente
- ✅ **Corregido problema de permisos admin:** Administradores pueden acceder al panel correctamente
- ✅ **Corregida carga de datos:** `useMemo` y `useCallback` actualizados para re-cálculo correcto

#### **v2.1.3 - Correcciones de Subvenciones**
- ✅ **Corregido parsing de moneda:** Manejo de formatos como "34.564,30 €" y "PDTE"
- ✅ **Corregido procesamiento de fases:** Conversión de "X" a boolean y manejo de texto
- ✅ **Corregido formato de fechas:** Campos de abono como texto en lugar de fecha
- ✅ **Corregida importación CSV:** Sincronización correcta con base de datos

#### **v2.1.2 - Correcciones de Rendimiento y Estabilidad**
- ✅ **Corregido error `setGeneralData is not defined`:** Eliminada referencia incorrecta a función no definida
- ✅ **Corregido error `setBrunoData is not defined`:** Eliminada referencia incorrecta a función no definida
- ✅ **Optimización de logs:** Eliminados cientos de `console.log` que ralentizaban la carga
- ✅ **Corregido texto desfasado:** Mensajes actualizados para reflejar integración con Holded
- ✅ **Mejorado feedback de carga:** Usuario ahora ve progreso específico durante sincronización
- ✅ **Corregida carga de datos Solucions:** Datos ahora se cargan correctamente desde Holded
- ✅ **Optimizado rendimiento:** Carga de datos significativamente más rápida

#### **v2.1.1 y anteriores - Correcciones Históricas**
- ✅ **Corregido error de CSP:** Bloqueo de conexiones a GitHub API
- ✅ **Corregido estado de verificación:** El botón ya no se queda colgado
- ✅ **Corregida versión mostrada:** Ahora muestra correctamente la versión 2.0.9
- ✅ **Corregidos permisos:** Jefes ya no ven "Solo lectura" incorrectamente
- ✅ **Corregido procesamiento Excel:** Manejo robusto de columnas vacías y caracteres especiales
- ✅ **Corregido cálculo de totales:** Filtrado correcto de filas "TOTAL" en datos IDONI
- ✅ **Corregida superposición UI:** Elementos de análisis correctamente posicionados
- ✅ **Corregidos errores de eliminación:** Foreign key constraints en eliminación de usuarios
- ✅ **Corregidos cálculos financieros:** Montos pendientes en lugar de totales
- ✅ **Corregida exportación Excel:** Consistencia entre vistas y archivos descargados
- ✅ **Limpieza de código:** Eliminados logs de debugging y funciones de prueba
- ✅ **Exportación Bruno optimizada:** IBAN solo una vez por proveedor, columnas Total/Pendiente correctas, formato mejorado con separaciones y totales organizados
- ✅ **Exportación Sergi mejorada:** Misma lógica que Bruno, texto del total y suma en fila separada
- ✅ **Formato Excel mejorado:** Valores numéricos para permitir sumas automáticas en Excel
- ✅ **Gráficos IDONI optimizados:** Etiquetas del eje X limpias (solo código) con tooltips informativos
- ✅ **Tabla de productos mejorada:** Ancho fijo (1150px) con scroll horizontal controlado
- ✅ **Análisis mensual granular:** Reemplazado sistema de trimestres por meses individuales

### 🔧 Mejoras Técnicas

#### **v2.1.4 - Arquitectura Multi-Entidad y Base de Datos**
- ✅ **Servicios especializados:** `subvencionesService.js` y `menjarDhortService.js` para cada entidad
- ✅ **Procesamiento CSV horizontal:** Transposición de datos para formato Menjar d'Hort
- ✅ **Función SQL `is_admin()`:** Solución a recursión infinita en RLS con `SECURITY DEFINER`
- ✅ **Gestión de estado React optimizada:** `useMemo` y `useCallback` con dependencias correctas
- ✅ **Sistema de caché inteligente:** Datos en memoria para ambas entidades
- ✅ **Modal de edición adaptativo:** Manejo de fases como objeto (EI SSS) y string (Menjar d'Hort)
- ✅ **Base de datos dual:** Tablas `subvenciones` y `subvenciones_menjar_dhort` especializadas

#### **v2.1.3 - Sistema de Subvenciones**
- ✅ **Parsing de moneda avanzado:** Manejo de formatos europeos, porcentajes y texto descriptivo
- ✅ **Conversión de fases:** Sistema híbrido boolean/texto para máxima flexibilidad
- ✅ **Integración Supabase completa:** CRUD operations con RLS policies
- ✅ **Análisis de fases inteligente:** Detección automática de fases activas
- ✅ **Sistema de comentarios:** Persistencia y gestión de comentarios por subvención

#### **v2.1.2 - Optimizaciones de Rendimiento**
- ✅ **Logs optimizados:** Eliminación de `console.log` verbosos en servicios API
- ✅ **Carga asíncrona mejorada:** Mensajes de progreso específicos por fase de carga
- ✅ **Gestión de estados optimizada:** Corrección de referencias a funciones no definidas
- ✅ **Feedback visual dinámico:** Sistema de mensajes de carga contextual
- ✅ **Integración Holded mejorada:** Carga directa sin dependencias de tablas intermedias
- ✅ **Rendimiento de UI:** Reducción significativa del tiempo de renderizado

#### **v2.1.1 y anteriores - Mejoras Históricas**
- ✅ **API de GitHub mejorada:** Headers apropiados y manejo de errores
- ✅ **Comparación de versiones:** Lógica robusta para detectar nuevas versiones
- ✅ **Mensajes informativos:** Feedback claro sobre el estado de actualizaciones
- ✅ **Integración con electron-updater:** Sistema de actualizaciones nativo de Electron
- ✅ **Base de datos IDONI:** Nuevas tablas `idoni_ventas_diarias` e `idoni_ventas_horas`
- ✅ **Procesamiento Excel avanzado:** Detección automática de headers y validación de datos
- ✅ **Análisis estadístico:** Cálculo de promedios, tendencias y métricas de rendimiento
- ✅ **Función SQL robusta:** `complete_delete_user_cascade` con verificaciones EXISTS
- ✅ **API Holded optimizada:** Consultas específicas para facturas parcialmente pagadas
- ✅ **Exportación Excel inteligente:** Manejo de límites y cálculos precisos
- ✅ **Sistema RBAC avanzado:** Control granular de permisos por rol
- ✅ **Código optimizado:** Eliminación de logs verbosos y funciones de prueba

## 📋 Requisitos del Sistema

### 💻 Sistema Operativo
- ✅ Windows 10/11 (64-bit)
- ✅ macOS 10.15+ (próximamente)
- ✅ Linux Ubuntu 18.04+ (próximamente)

### 🔧 Especificaciones Mínimas
- **RAM:** 4 GB
- **Almacenamiento:** 500 MB libres
- **Procesador:** Intel/AMD de 2 GHz o superior
- **Conexión:** Internet para sincronización y actualizaciones

## 🚀 Instalación

### 📥 Descargar
1. Ve a la sección Releases de este repositorio
2. Descarga `SSS Kronos-2.1.19 Setup.exe`
3. Ejecuta el instalador y sigue las instrucciones

### ⚡ Primera Ejecución
1. Abre SSS Kronos desde el menú de inicio
2. Crea tu cuenta con email corporativo
3. Completa tu perfil y selecciona tu rol
4. Comienza a usar la aplicación

## 🔄 Sistema de Actualizaciones

### Automático
- La aplicación verifica actualizaciones automáticamente al iniciar
- Los usuarios reciben notificaciones cuando hay nuevas versiones
- Las actualizaciones se descargan en segundo plano

### Manual
- Ve a **Configuración > Actualizaciones**
- Haz clic en **"Verificar Actualizaciones"**
- Si hay una nueva versión, haz clic en **"Descargar Actualización"**
- La aplicación se reiniciará automáticamente con la nueva versión

### Permisos
- **Administradores:** Acceso completo a todas las funciones
- **Jefes (Management/Manager):** Pueden instalar actualizaciones
- **Usuarios básicos:** Pueden instalar actualizaciones y acceder a configuración

## 📚 Documentación

- **README principal:** Instrucciones de instalación y uso
- **Documentación técnica:** Carpeta `docs/` con soluciones detalladas
- **Gestión Tienda:** [docs/GESTION_TIENDA.md](docs/GESTION_TIENDA.md) — Hojas Técnicas, Confirmación Productos, dependencias PDF (jspdf)
- **Configuración:** Guías para desarrolladores
- **Scripts SQL:** `/database` para limpieza y mantenimiento
- **Esquema IDONI:** `database/idoni_schema.sql` para configuración de base de datos

## 🆘 Soporte

- **Email:** brianbauma10@gmail.com
- **Issues:** Sección de problemas del repositorio
- **Documentación:** docs.supabase.com

## 🔄 Próximas Versiones

### 🎯 v2.1.19 ✅ **COMPLETADA**
- ✅ Módulo Gestión Tienda (Hojas Técnicas + Confirmación Productos Tienda) ✅
- ✅ Dependencias PDF (jspdf, jspdf-autotable) y corrección de error de compilación ✅
- ✅ Documentación [docs/GESTION_TIENDA.md](docs/GESTION_TIENDA.md) ✅

### 🎯 v2.1.18 ✅ **COMPLETADA**
- ✅ Facturas de venta Holded en Análisis (toggle compra/venta, mismo diseño y selector de año) ✅
- ✅ Vista Bruno y Sergi con textos cliente/cobro para ventas ✅
- ✅ Exportación Excel con etiquetas condicionales (Cliente, Pendiente de cobro, etc.) ✅
- ✅ Socios IDONI: campos DNI y teléfono, importación CSV e interfaz ✅
- ✅ Corrección de fechas de registro de socios (socio_desde como fecha local) ✅
- ✅ Animación al cambiar entre Facturas de compra y Facturas de venta ✅

### 🎯 v2.1.16 ✅ **COMPLETADA**
- ✅ Filtrado por año en Analytics con selector dinámico ✅
- ✅ Carga de facturas históricas (2025 y 2026) ✅
- ✅ Formato de fechas corregido (timestamps Unix) ✅
- ✅ Logs de depuración extensivos para diagnóstico ✅
- ✅ Hojas de resumen Excel optimizadas (solo Pendiente) ✅
- ✅ Corrección de error 400 Bad Request en API Holded ✅
- ✅ Optimización de consultas por año específico ✅

### 🎯 v2.1.15 ✅ **COMPLETADA**
- ✅ Carga completa de datos IDONI con paginación ✅
- ✅ Corrección de 12 meses completos en gráficos y totales ✅
- ✅ Sistema de detección automática de productos a peso vs unitarios ✅
- ✅ Visualización diferenciada con "kg" para productos a peso ✅
- ✅ Gráficos separados con selector de tipo y cantidad ✅
- ✅ Orden cronológico correcto en gráfico de días de la semana ✅
- ✅ Totales precisos incluyendo todos los meses ✅

### 🎯 v2.1.14 ✅ **COMPLETADA**
- ✅ Sistema completo de fichaje con cumplimiento normativa laboral española ✅
- ✅ Gestión de pausas obligatorias (comida y descansos) ✅
- ✅ Panel de administración de fichajes con filtros y exportación ✅
- ✅ Sistema de notificaciones para cambios en fichajes ✅
- ✅ Auditoría completa con retención de 4 años ✅
- ✅ Migración a TIMESTAMPTZ para zona horaria correcta ✅
- ✅ Hoja de resumen en Excel de Sergi y Bruno con totales ✅
- ✅ Selector de hojas en header para navegación rápida ✅
- ✅ Botón "Cargar" en modal de histórico ✅
- ✅ Corrección de bucle infinito al subir hojas ✅
- ✅ Gestión de estado optimizada con useRef ✅
- ✅ Soporte para múltiples hojas de ruta activas ✅
- ✅ Limpieza completa de código (logs y archivos temporales) ✅

### 🎯 v2.1.13 ✅ **COMPLETADA**
- ✅ Análisis detallado por día de la semana en IDONI ✅
- ✅ Agrupación automática de registros duplicados ✅
- ✅ Corrección de días de la semana en gráficos y tablas ✅
- ✅ Bloqueo de botones durante carga ✅
- ✅ Spinner de carga mejorado para IDONI ✅
- ✅ Alineación consistente de spinners ✅

### 🎯 v2.1.12 ✅ **COMPLETADA**
- ✅ Sistema de verificación de listas y material (texto) ✅
- ✅ Selección de facturas para exportación ✅
- ✅ Botones de sincronización y reset ✅
- ✅ Corrección de datos Bruno (infinity, IBANs) ✅
- ✅ Pantalla de carga en análisis ✅

### 🎯 v2.1.4 ✅ **COMPLETADA**
- 🏢 Sistema de entidades múltiples (EI SSS + Menjar d'Hort) ✅
- 👥 Panel de administración completo ✅
- 📚 Onboarding actualizado con advertencia BETA ✅
- 🔧 Corrección de errores críticos de RLS ✅
- 💰 Cálculos financieros precisos ✅
- 📊 Interfaz de selección de entidad ✅

### 🎯 v2.1.3 ✅ **COMPLETADA**
- 📊 Sistema de subvenciones con base de datos ✅
- 💾 Integración completa con Supabase ✅
- 📝 Sistema de comentarios ✅
- 📁 Importación CSV automática ✅
- 🔍 Filtros avanzados ✅
- 🎨 Temas claro/oscuro ✅

### 🎯 v2.2.0 (Planificada)
- 📊 Análisis comparativo entre años para IDONI
- 📈 Predicciones de ventas con IA
- 🔄 Sincronización automática con sistemas externos
- 📱 Mejoras en la interfaz móvil
- 🔐 Sistema de permisos más granular
- 📊 Reportes ejecutivos personalizables
- 🏢 Soporte para más entidades de subvenciones


## 📄 Licencia

Este proyecto está bajo la licencia MIT. Ver el archivo LICENSE para más detalles.

---

**Desarrollado con ❤️ por Brian Bautista para Solucions Socials** 