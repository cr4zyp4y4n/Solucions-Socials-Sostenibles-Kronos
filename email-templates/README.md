# Configuración de Emails de Bienvenida en Supabase

## 📧 Plantillas de Email Personalizadas para SSS Kronos

### Archivos Incluidos:
- `welcome-email.html` - Versión HTML con diseño profesional
- `welcome-email.txt` - Versión de texto plano para compatibilidad

## 🚀 Pasos para Configurar en Supabase:

### 1. Acceder al Dashboard de Supabase
1. Ve a [supabase.com](https://supabase.com)
2. Inicia sesión con tu cuenta
3. Selecciona tu proyecto **SSS Kronos**

### 2. Configurar las Plantillas de Email
1. Ve a **Authentication** en el menú lateral
2. Haz clic en **Email Templates**
3. Selecciona la plantilla **"Confirm signup"**

### 3. Personalizar la Plantilla HTML
1. Copia el contenido de `welcome-email.html`
2. Pégalo en el campo **HTML Template**
3. Guarda los cambios

### 4. Personalizar la Plantilla de Texto
1. Copia el contenido de `welcome-email.txt`
2. Pégalo en el campo **Text Template**
3. Guarda los cambios

### 5. Configurar el Asunto del Email
Cambia el asunto por:
```
¡Bienvenido a SSS Kronos! Confirma tu cuenta
```

## 🎨 Características del Diseño:

### **Branding Consistente:**
- Colores de SSS Kronos (verde Solucions #4CAF50)
- Paleta de grises y blancos profesional
- Diseño minimalista y moderno

### **Funcionalidades:**
- ✅ **Responsive** - Se adapta a móvil y escritorio
- ✅ **Accesible** - Versión texto plano incluida
- ✅ **Profesional** - Diseño corporativo
- ✅ **Informativo** - Explica las funcionalidades principales

### **Variables Disponibles:**
- `{{ .Email }}` - Email del usuario
- `{{ .SiteURL }}` - URL de tu aplicación
- `{{ .TokenHash }}` - Token de confirmación
- `{{ .ConfirmationURL }}` - URL completa de confirmación

## 🔧 Configuración Adicional:

### **URL de Redirección:**
Configura la URL de redirección después de la confirmación:
```
https://tu-dominio.com/dashboard
```

### **Configuración SMTP (Opcional):**
Si quieres usar tu propio servidor SMTP:
1. Ve a **Settings** → **Auth**
2. Configura **SMTP Settings**
3. Usa tu proveedor de email preferido

## 📱 Personalización Adicional:

### **Incluir Logo Real:**
Para usar el logo real de SSS Kronos:
1. Sube el logo a un CDN o servidor web
2. Reemplaza el placeholder en el HTML:
```html
<img src="https://tu-dominio.com/logo.png" alt="SSS Kronos" />
```

### **Personalizar Colores:**
Modifica los colores en el CSS:
```css
.primary-color { color: #4CAF50; }
.gradient { background: linear-gradient(135deg, #4CAF50 0%, #66BB6A 100%); }
```

## 🧪 Probar la Configuración:

### **Email de Prueba:**
1. Ve a **Authentication** → **Users**
2. Crea un usuario de prueba
3. Verifica que reciba el email personalizado

### **Verificar Funcionalidad:**
1. El enlace de confirmación debe redirigir correctamente
2. El usuario debe poder confirmar su cuenta
3. Debe ser redirigido al dashboard después de confirmar

## 📞 Soporte:

Si tienes problemas con la configuración:
1. Verifica que las variables estén correctamente escritas
2. Asegúrate de que la URL de redirección sea válida
3. Revisa los logs de Supabase para errores

---

**¡Listo!** Tu aplicación SSS Kronos ahora tendrá emails de bienvenida profesionales y personalizados. 🎉 