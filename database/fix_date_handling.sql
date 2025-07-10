-- Script para mejorar el manejo de fechas en SSS Kronos
-- Ejecutar este script en el SQL Editor de Supabase

-- ===========================================
-- MEJORAR MANEJO DE FECHAS
-- ===========================================

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

-- ===========================================
-- VERIFICAR CONFIGURACIÓN
-- ===========================================

-- Verificar que las funciones se crearon correctamente
SELECT 
  proname as function_name,
  prosrc as function_source
FROM pg_proc 
WHERE proname IN ('convert_excel_date', 'parse_date_string');

-- ===========================================
-- NOTAS IMPORTANTES
-- ===========================================

/*
Este script mejora el manejo de fechas para evitar el error:
"time zone displacement out of range: +096413-12-31"

Las funciones creadas:
1. convert_excel_date(): Convierte fechas de Excel de forma segura
2. parse_date_string(): Parsea fechas en formato string de forma robusta

Estas funciones se usan en el código JavaScript para validar fechas antes de insertarlas en la base de datos.
*/ 