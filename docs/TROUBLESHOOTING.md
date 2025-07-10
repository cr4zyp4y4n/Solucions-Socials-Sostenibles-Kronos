# 🔧 Solución de Problemas - SSS Kronos

## ❌ Error: "Failed to fetch"

Este error indica que hay un problema de conexión con Supabase. Vamos a solucionarlo paso a paso:

### 🔍 **Paso 1: Verificar configuración de Supabase**

1. **Abre `src/config/supabase.js`**
2. **Verifica que las credenciales sean correctas:**
   ```javascript
   const SUPABASE_URL = 'https://zalnsacawwekmibhoiba.supabase.co';
   const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
   ```

### 🔍 **Paso 2: Verificar que el schema se ejecutó correctamente**

1. **Ve a tu proyecto Supabase Dashboard**
2. **Ve a Database > Tables**
3. **Verifica que existan estas tablas:**
   - ✅ `user_profiles`
   - ✅ `excel_uploads`
   - ✅ `invoices`
   - ✅ `providers`
   - ✅ `analytics`

### 🔍 **Paso 3: Verificar RLS (Row Level Security)**

1. **Ve a Database > Tables**
2. **Haz clic en cada tabla**
3. **Verifica que RLS esté habilitado**
4. **Verifica que existan las políticas**

### 🔍 **Paso 4: Probar conexión desde la app**

1. **Ejecuta la aplicación:**
   ```bash
   npm start
   ```

2. **Ve a Configuración**
3. **Ver el componente "Prueba de Conexión"**
4. **Revisar el estado de la conexión**

### 🔍 **Paso 5: Verificar en la consola del navegador**

1. **Abre las herramientas de desarrollador (F12)**
2. **Ve a la pestaña Console**
3. **Busca errores relacionados con Supabase**

## 🚨 **Errores comunes y soluciones:**

### ❌ **Error: "relation 'user_profiles' does not exist"**
**Solución:**
- Ejecuta el schema SQL completo en Supabase
- Verifica que la tabla se creó correctamente

### ❌ **Error: "RLS policy violation"**
**Solución:**
- Verifica que las políticas RLS estén creadas
- Asegúrate de que el usuario esté autenticado

### ❌ **Error: "Invalid API key"**
**Solución:**
- Verifica que la anon key sea correcta
- Asegúrate de que no haya espacios extra

### ❌ **Error: "Network error"**
**Solución:**
- Verifica tu conexión a internet
- Verifica que Supabase esté funcionando

## 🔧 **Comandos de diagnóstico:**

### **Verificar dependencias:**
```bash
npm list @supabase/supabase-js
```

### **Reinstalar dependencias:**
```bash
rm -rf node_modules package-lock.json
npm install
```

### **Limpiar caché:**
```bash
npm cache clean --force
```

## 📋 **Checklist de verificación:**

### ✅ **Configuración básica:**
- [ ] Credenciales de Supabase correctas
- [ ] Schema SQL ejecutado
- [ ] Tablas creadas
- [ ] RLS habilitado
- [ ] Políticas configuradas

### ✅ **Aplicación:**
- [ ] Dependencias instaladas
- [ ] Aplicación ejecutándose
- [ ] Sin errores en consola
- [ ] Componente de prueba funcionando

### ✅ **Autenticación:**
- [ ] Registro de usuarios funciona
- [ ] Login funciona
- [ ] Perfiles se crean automáticamente
- [ ] Sesión persiste

## 🆘 **Si nada funciona:**

1. **Revisa los logs de Supabase:**
   - Ve a Dashboard > Logs
   - Busca errores recientes

2. **Verifica el estado de Supabase:**
   - Ve a [status.supabase.com](https://status.supabase.com)

3. **Contacta soporte:**
   - Email: brianbauma10@gmail.com
   - Documentación: [docs.supabase.com](https://docs.supabase.com)

## 🎯 **Próximos pasos después de solucionar:**

1. **Probar registro de usuarios**
2. **Probar login**
3. **Probar subida de archivos**
4. **Probar análisis de datos**

---

**¡Con estos pasos deberías poder solucionar cualquier problema de conexión!** 