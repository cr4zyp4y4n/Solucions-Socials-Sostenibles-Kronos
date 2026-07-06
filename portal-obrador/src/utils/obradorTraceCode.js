export function extractTraceCodeFromScan(input) {
  const raw = String(input || '').trim();
  if (!raw) return '';

  if (/^https?:\/\//i.test(raw)) {
    try {
      const trace = new URL(raw).searchParams.get('trace');
      if (trace?.trim()) return trace.trim();
    } catch {
      // ignore
    }
  }

  const traceMatch = raw.match(/[?&]trace=([^&\s#]+)/i);
  if (traceMatch) {
    try {
      return decodeURIComponent(traceMatch[1]).trim();
    } catch {
      return traceMatch[1].trim();
    }
  }

  return raw.replace(/\s+/g, '');
}

export function normalitzarCodiQR(input) {
  const t = extractTraceCodeFromScan(input);
  if (!t) return '';
  if (/^qr-/i.test(t)) return `QR-${t.slice(3)}`;
  return t;
}
