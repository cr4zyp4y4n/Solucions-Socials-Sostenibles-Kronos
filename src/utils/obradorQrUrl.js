/**
 * URL pública per escaneig d'etiquetes (portal-obrador ?trace=).
 * Configura OBRADOR_TRACE_BASE_URL al .env de Kronos (URL del portal desplegat).
 */
export function getObradorTraceBaseUrl() {
  try {
    const url = process.env.OBRADOR_TRACE_BASE_URL || '';
    return String(url).trim().replace(/\/$/, '');
  } catch {
    return '';
  }
}

/** Contingut del QR: URL si hi ha base configurada; sinó el codi intern (comportament antic). */
export function buildObradorQrPayload(codi_qr) {
  const codi = String(codi_qr || '').trim();
  if (!codi) return '';
  const base = getObradorTraceBaseUrl();
  if (!base) return codi;
  return `${base}/?trace=${encodeURIComponent(codi)}`;
}
