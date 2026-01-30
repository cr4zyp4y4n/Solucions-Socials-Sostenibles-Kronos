/**
 * Utilidades para manejo de fechas y horas con zona horaria de España
 * Usa date-fns-tz para manejo correcto de zonas horarias
 */

import { format, toZonedTime, formatInTimeZone } from 'date-fns-tz';
import { es } from 'date-fns/locale';

const TIMEZONE_MADRID = 'Europe/Madrid';

/**
 * Convierte un timestamp UTC a la zona horaria de España (Europe/Madrid)
 * @param {string|Date} dateString - Timestamp en formato ISO o Date object
 * @returns {Date} Date object ajustado a la zona horaria de España
 */
export function toMadridTime(dateString) {
  if (!dateString) return null;
  
  const date = typeof dateString === 'string' ? parseDateAsUTC(dateString) : dateString;
  
  // date-fns-tz maneja automáticamente la conversión de UTC a la zona horaria especificada
  return toZonedTime(date, TIMEZONE_MADRID);
}

/**
 * Formatea una hora en formato español (HH:MM)
 * @param {string|Date} dateString - Timestamp en formato ISO o Date object
 * @returns {string} Hora formateada (HH:MM)
 */
/**
 * Convierte un string de fecha sin timezone a Date object interpretándolo como UTC
 * @param {string} dateString - String de fecha (puede tener o no timezone)
 * @returns {Date} Date object interpretado correctamente
 */
function parseDateAsUTC(dateString) {
  // Si el string ya tiene 'Z' o timezone, usar directamente
  if (dateString.includes('Z') || dateString.includes('+') || dateString.includes('-', 10)) {
    return new Date(dateString);
  }
  
  // Si no tiene timezone, asumir que es UTC y agregar 'Z'
  // Formato esperado: "2025-12-31T10:12:11.073927" -> "2025-12-31T10:12:11.073927Z"
  const utcString = dateString.endsWith('Z') ? dateString : dateString + 'Z';
  return new Date(utcString);
}

export function formatTimeMadrid(dateString) {
  if (!dateString) return 'N/A';
  
  try {
    // Interpretar el string como UTC si no tiene timezone
    const date = typeof dateString === 'string' ? parseDateAsUTC(dateString) : dateString;
    
    // Usar formatInTimeZone para formatear directamente en la zona horaria de Madrid
    return formatInTimeZone(date, TIMEZONE_MADRID, 'HH:mm', { locale: es });
  } catch (error) {
    console.error('Error formateando hora:', error);
    return 'N/A';
  }
}

/**
 * Formatea una hora en formato español con segundos (HH:MM:SS)
 * @param {string|Date} dateString - Timestamp en formato ISO o Date object
 * @returns {string} Hora formateada (HH:MM:SS)
 */
export function formatTimeMadridWithSeconds(dateString) {
  if (!dateString) return 'N/A';
  
  try {
    const date = typeof dateString === 'string' ? parseDateAsUTC(dateString) : dateString;
    return formatInTimeZone(date, TIMEZONE_MADRID, 'HH:mm:ss', { locale: es });
  } catch (error) {
    console.error('Error formateando hora con segundos:', error);
    return 'N/A';
  }
}

/**
 * Formatea una fecha en formato español (día y mes)
 * @param {string|Date} dateString - Timestamp en formato ISO o Date object
 * @returns {string} Fecha formateada
 */
export function formatDateMadrid(dateString) {
  if (!dateString) return 'N/A';
  
  try {
    const date = typeof dateString === 'string' ? parseDateAsUTC(dateString) : dateString;
    return formatInTimeZone(date, TIMEZONE_MADRID, 'd MMM', { locale: es });
  } catch (error) {
    console.error('Error formateando fecha:', error);
    return 'N/A';
  }
}

/**
 * Formatea una fecha completa en formato español (día, mes y año)
 * @param {string|Date} dateString - Timestamp en formato ISO o Date object
 * @returns {string} Fecha formateada con año
 */
export function formatDateFullMadrid(dateString) {
  if (!dateString) return 'N/A';
  
  try {
    const date = typeof dateString === 'string' ? parseDateAsUTC(dateString) : dateString;
    return formatInTimeZone(date, TIMEZONE_MADRID, 'd MMMM yyyy', { locale: es });
  } catch (error) {
    console.error('Error formateando fecha completa:', error);
    return 'N/A';
  }
}

/**
 * Formatea una fecha corta en formato español (día, mes corto y año)
 * @param {string|Date} dateString - Timestamp en formato ISO o Date object
 * @returns {string} Fecha formateada con año corto
 */
export function formatDateShortMadrid(dateString) {
  if (!dateString) return 'N/A';
  
  try {
    const date = typeof dateString === 'string' ? parseDateAsUTC(dateString) : dateString;
    return formatInTimeZone(date, TIMEZONE_MADRID, 'd MMM yyyy', { locale: es });
  } catch (error) {
    console.error('Error formateando fecha corta:', error);
    return 'N/A';
  }
}

/**
 * Formatea fecha y hora completa en formato español
 * @param {string|Date} dateString - Timestamp en formato ISO o Date object
 * @returns {string} Fecha y hora formateada
 */
export function formatDateTimeMadrid(dateString) {
  if (!dateString) return 'N/A';
  
  try {
    const date = typeof dateString === 'string' ? parseDateAsUTC(dateString) : dateString;
    return formatInTimeZone(date, TIMEZONE_MADRID, 'd MMM yyyy, HH:mm', { locale: es });
  } catch (error) {
    console.error('Error formateando fecha y hora:', error);
    return 'N/A';
  }
}

/**
 * Parsea un valor "solo fecha" (YYYY-MM-DD o ISO con hora) como fecha LOCAL.
 * - Si es YYYY-MM-DD: se interpreta como día local (no UTC).
 * - Si es ISO con T (ej. 2024-01-14T23:00:00.000Z): se usa el día en hora local de ese instante.
 * @param {string|Date} value - Fecha en formato YYYY-MM-DD o ISO
 * @returns {Date|null} Date en hora local o null
 */
export function parseDateOnlyAsLocal(value) {
  if (value == null) return null;
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return null;
    // Usar día local para no depender de UTC
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }
  const s = String(value).trim();
  // Si viene con hora (ISO), interpretar como instante y tomar día local
  if (s.includes('T') || s.includes('Z') || /^\d{4}-\d{2}-\d{2}.+\d/.test(s)) {
    const d = new Date(s);
    if (!isNaN(d.getTime()))
      return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    return null;
  }
  // Solo YYYY-MM-DD: interpretar como día local
  const match = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const y = parseInt(match[1], 10);
    const m = parseInt(match[2], 10) - 1;
    const d = parseInt(match[3], 10);
    const date = new Date(y, m, d);
    return isNaN(date.getTime()) ? null : date;
  }
  return null;
}

/**
 * Formatea una fecha "solo día" (ej. socio_desde) en español, interpretando YYYY-MM-DD como fecha local.
 * @param {string|Date} value - Fecha en formato YYYY-MM-DD o ISO
 * @param {Object} [options] - Opciones de toLocaleDateString
 * @returns {string} Fecha formateada o ''
 */
export function formatDateOnlyLocal(value, options = { year: 'numeric', month: 'long', day: 'numeric' }) {
  const date = parseDateOnlyAsLocal(value);
  if (!date) return '';
  return date.toLocaleDateString('es-ES', options);
}

/**
 * Obtiene el año de una fecha "solo día" (YYYY-MM-DD) como fecha local.
 * @param {string|Date} value - Fecha en formato YYYY-MM-DD o ISO
 * @returns {number} Año (ej. 2024) o NaN
 */
export function getYearFromDateOnly(value) {
  const date = parseDateOnlyAsLocal(value);
  return date ? date.getFullYear() : NaN;
}

/**
 * Obtiene la hora actual del servidor desde Supabase
 * @param {Object} supabase - Cliente de Supabase
 * @returns {Promise<Date>} Fecha actual del servidor en zona horaria de Madrid
 */
export async function getServerTimeMadrid(supabase) {
  try {
    const { data, error } = await supabase.rpc('get_server_time_madrid');
    
    if (error) throw error;
    
    // Convertir el string a Date object
    return new Date(data);
  } catch (error) {
    console.error('Error obteniendo hora del servidor:', error);
    // Fallback a hora local (no ideal, pero mejor que nada)
    return new Date();
  }
}

