# Solución al Error de Fechas en SSS Kronos

## Problema
Al subir archivos Excel, aparece el error:
```
Error al procesar y subir el archivo: Error al guardar datos procesados: time zone displacement out of range: "+096413-12-31"
```

## Causa
El error ocurre porque las fechas de Excel se están convirtiendo incorrectamente, generando fechas inválidas que PostgreSQL no puede procesar.

## Solución

### Paso 1: Ejecutar Script SQL
Ejecuta el siguiente script en el **SQL Editor** de Supabase:

```sql
-- Función mejorada para convertir fechas de Excel
CREATE OR REPLACE FUNCTION convert_excel_date(excel_date_value NUMERIC)
RETURNS DATE
LANGUAGE plpgsql
AS $$
DECLARE
  converted_date DATE;
BEGIN
  -- Validar que el valor no sea nulo
  IF excel_date_value IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Validar que el valor sea un número válido
  IF excel_date_value < 1 OR excel_date_value > 999999 THEN
    RETURN NULL;
  END IF;
  
  -- Convertir fecha de Excel (días desde 1900-01-01)
  -- Excel usa 1900 como año base, pero tiene un bug: considera 1900 como año bisiesto
  -- Por eso restamos 2 días en lugar de 1
  converted_date := DATE '1900-01-01' + (excel_date_value - 2) * INTERVAL '1 day';
  
  -- Validar que la fecha resultante sea razonable
  IF converted_date < DATE '1900-01-01' OR converted_date > DATE '2100-12-31' THEN
    RETURN NULL;
  END IF;
  
  RETURN converted_date;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$;

-- Función para parsear fechas en formato string
CREATE OR REPLACE FUNCTION parse_date_string(date_string TEXT)
RETURNS DATE
LANGUAGE plpgsql
AS $$
DECLARE
  parsed_date DATE;
BEGIN
  -- Validar que el string no sea nulo o vacío
  IF date_string IS NULL OR TRIM(date_string) = '' THEN
    RETURN NULL;
  END IF;
  
  -- Intentar parsear diferentes formatos de fecha
  BEGIN
    -- Formato ISO (YYYY-MM-DD)
    IF date_string ~ '^\d{4}-\d{2}-\d{2}$' THEN
      parsed_date := date_string::DATE;
    -- Formato español (DD/MM/YYYY)
    ELSIF date_string ~ '^\d{1,2}/\d{1,2}/\d{4}$' THEN
      parsed_date := TO_DATE(date_string, 'DD/MM/YYYY');
    -- Formato catalán (DD-MM-YYYY)
    ELSIF date_string ~ '^\d{1,2}-\d{1,2}-\d{4}$' THEN
      parsed_date := TO_DATE(date_string, 'DD-MM-YYYY');
    -- Otros formatos comunes
    ELSE
      parsed_date := date_string::DATE;
    END IF;
    
    -- Validar que la fecha sea razonable
    IF parsed_date < DATE '1900-01-01' OR parsed_date > DATE '2100-12-31' THEN
      RETURN NULL;
    END IF;
    
    RETURN parsed_date;
  EXCEPTION
    WHEN OTHERS THEN
      RETURN NULL;
  END;
END;
$$;
```

### Paso 2: Verificar la Instalación
Después de ejecutar el script, verifica que las funciones se crearon correctamente:

```sql
-- Verificar que las funciones se crearon correctamente
SELECT 
  proname as function_name,
  prosrc as function_source
FROM pg_proc 
WHERE proname IN ('convert_excel_date', 'parse_date_string');
```

### Paso 3: Actualizar la Aplicación
El código JavaScript ya incluye las mejoras en el manejo de fechas. Las funciones `convertExcelDate()` y `parseDateString()` en `HomePage.jsx` ahora:

1. **Validan fechas de Excel** antes de convertirlas
2. **Manejan múltiples formatos** de fecha
3. **Previenen fechas inválidas** que causan errores
4. **Retornan null** en lugar de fechas inválidas

## Mejoras Implementadas

### En el Código JavaScript:
- ✅ Validación de rangos de fechas (1900-2100)
- ✅ Manejo de diferentes formatos de fecha
- ✅ Conversión segura de fechas de Excel
- ✅ Prevención de fechas inválidas

### En la Base de Datos:
- ✅ Funciones SQL para validación de fechas
- ✅ Manejo robusto de errores
- ✅ Conversión segura de fechas de Excel

## Prueba de la Solución

1. **Sube un archivo Excel** desde la aplicación
2. **Verifica que no aparezcan errores** de fechas
3. **Comprueba que los datos** se procesan correctamente

## Notas Técnicas

### ¿Por qué ocurría el error?
- Excel almacena fechas como números (días desde 1900-01-01)
- La conversión anterior no manejaba correctamente el bug de Excel (1900 como año bisiesto)
- Fechas inválidas generaban errores de timezone en PostgreSQL

### ¿Cómo se soluciona?
- Se resta 2 días en lugar de 1 para corregir el bug de Excel
- Se valida que las fechas estén en rangos razonables
- Se manejan múltiples formatos de fecha
- Se previenen fechas inválidas antes de insertarlas

## Verificación

Para verificar que la solución funciona:

```sql
-- Probar la función de conversión de Excel
SELECT convert_excel_date(45000); -- Debería retornar una fecha válida

-- Probar la función de parseo de strings
SELECT parse_date_string('2025-01-15'); -- Debería retornar una fecha válida
SELECT parse_date_string('15/01/2025'); -- Debería retornar una fecha válida
```

## Soporte

Si el problema persiste después de aplicar esta solución:

1. **Verifica que las funciones SQL** se ejecutaron correctamente
2. **Revisa los logs** de la aplicación para más detalles
3. **Contacta al soporte técnico** con los detalles del error 