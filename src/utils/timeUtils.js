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

