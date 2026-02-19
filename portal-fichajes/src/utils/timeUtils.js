import { formatInTimeZone } from 'date-fns-tz';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const TIMEZONE_MADRID = 'Europe/Madrid';

function parseDate(dateString) {
  if (!dateString) return null;
  const str = typeof dateString === 'string' && !dateString.endsWith('Z') && !dateString.includes('+') && !dateString.includes('-', 10)
    ? dateString + 'Z'
    : dateString;
  return new Date(str);
}

export function formatTimeMadrid(dateString) {
  if (!dateString) return 'N/A';
  try {
    const date = parseDate(dateString);
    return formatInTimeZone(date, TIMEZONE_MADRID, 'HH:mm', { locale: es });
  } catch {
    return 'N/A';
  }
}

export function formatDateShortMadrid(dateString) {
  if (!dateString) return 'N/A';
  try {
    const date = typeof dateString === 'string' && dateString.length === 10
      ? new Date(dateString + 'T12:00:00Z')
      : parseDate(dateString);
    return format(date, 'd MMM', { locale: es });
  } catch {
    return 'N/A';
  }
}

export function formatTimeMadridWithSeconds(dateString) {
  if (!dateString) return 'N/A';
  try {
    const date = parseDate(dateString);
    return formatInTimeZone(date, TIMEZONE_MADRID, 'HH:mm:ss', { locale: es });
  } catch {
    return 'N/A';
  }
}
