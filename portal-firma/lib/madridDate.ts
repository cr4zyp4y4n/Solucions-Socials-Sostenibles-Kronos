/** Fechas de evidencias de firma: siempre Europe/Madrid con offset visible. */

const TZ = 'Europe/Madrid';

/**
 * Formato: `22/09/2026 16:33:06 (UTC+02:00)`.
 * Si `iso` es inválido, devuelve cadena vacía.
 */
export function formatMadridDateTime(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';

  const parts = new Intl.DateTimeFormat('es-ES', {
    timeZone: TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).formatToParts(d);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value || '';

  const offset =
    new Intl.DateTimeFormat('en-US', {
      timeZone: TZ,
      timeZoneName: 'longOffset'
    })
      .formatToParts(d)
      .find((p) => p.type === 'timeZoneName')?.value || 'UTC';

  // longOffset → "GMT+02:00" → "UTC+02:00"
  const offsetLabel = offset.replace(/^GMT/, 'UTC');

  return `${get('day')}/${get('month')}/${get('year')} ${get('hour')}:${get('minute')}:${get('second')} (${offsetLabel})`;
}
