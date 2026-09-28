import { normalizeDni } from '@/lib/normalizeDni';

export type IdentidadOcrStatus =
  | 'pending'
  | 'match'
  | 'no_match'
  | 'ilegible'
  | 'error'
  | 'skipped';

export type IdentidadOcrResult = {
  status: IdentidadOcrStatus;
  match: boolean;
  confianza: number;
  dniDetectado: string | null;
  candidatos: string[];
  /** Texto OCR completo (para re-evaluación en servidor); no persistir entero en BBDD. */
  ocrText?: string;
  detalle: Record<string, unknown>;
};

/** Extrae candidatos DNI (8 dígitos+letra) y NIE (X/Y/Z+7+letra) del texto OCR. */
export function extractDniCandidates(ocrText: string): string[] {
  const cleaned = String(ocrText || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, ' ');
  const found = new Set<string>();
  for (const m of cleaned.matchAll(/\b\d{8}[A-Z]\b/g)) found.add(m[0]);
  for (const m of cleaned.matchAll(/\b[XYZ]\d{7}[A-Z]\b/g)) found.add(m[0]);
  // Variantes sin word-boundary claras (OCR pega caracteres)
  const compact = cleaned.replace(/\s+/g, '');
  for (const m of compact.matchAll(/\d{8}[A-Z]/g)) found.add(m[0]);
  for (const m of compact.matchAll(/[XYZ]\d{7}[A-Z]/g)) found.add(m[0]);
  return [...found];
}

/**
 * Compara texto OCR con el DNI esperado del trabajador.
 * Señales soft: no es KYC; prioriza inclusión del DNI normalizado en el texto.
 */
export function evaluateIdentidadOcr(
  ocrText: string,
  expectedDni: string | null | undefined,
  extra: Record<string, unknown> = {}
): IdentidadOcrResult {
  const exp = normalizeDni(expectedDni);
  const text = String(ocrText || '');
  const flat = normalizeDni(text);
  const candidatos = extractDniCandidates(text);
  const snippet = text.replace(/\s+/g, ' ').trim().slice(0, 280);
  const baseDetalle = {
    ...extra,
    charCount: text.length,
    snippet,
    candidatos
  };

  if (!exp) {
    return {
      status: 'skipped',
      match: false,
      confianza: 0,
      dniDetectado: candidatos[0] || null,
      candidatos,
      ocrText: text,
      detalle: { ...baseDetalle, reason: 'sin_dni_en_bbdd' }
    };
  }

  if (!text.trim()) {
    return {
      status: 'ilegible',
      match: false,
      confianza: 0.05,
      dniDetectado: null,
      candidatos: [],
      ocrText: text,
      detalle: { ...baseDetalle, reason: 'ocr_vacio' }
    };
  }

  if (flat.includes(exp)) {
    return {
      status: 'match',
      match: true,
      confianza: 0.92,
      dniDetectado: exp,
      candidatos: candidatos.includes(exp) ? candidatos : [exp, ...candidatos],
      ocrText: text,
      detalle: { ...baseDetalle, reason: 'substring_exacta' }
    };
  }

  if (candidatos.includes(exp)) {
    return {
      status: 'match',
      match: true,
      confianza: 0.88,
      dniDetectado: exp,
      candidatos,
      ocrText: text,
      detalle: { ...baseDetalle, reason: 'candidato_exacto' }
    };
  }

  // Prefijo numérico (OCR a menudo falla la letra de control)
  const digits = exp.replace(/[^0-9]/g, '');
  if (digits.length >= 7 && flat.includes(digits.slice(0, 7))) {
    const near = candidatos.find((c) => c.startsWith(digits.slice(0, 7))) || null;
    return {
      status: 'no_match',
      match: false,
      confianza: 0.45,
      dniDetectado: near,
      candidatos,
      ocrText: text,
      detalle: { ...baseDetalle, reason: 'prefijo_parcial_sin_letra' }
    };
  }

  if (candidatos.length > 0) {
    return {
      status: 'no_match',
      match: false,
      confianza: 0.25,
      dniDetectado: candidatos[0],
      candidatos,
      ocrText: text,
      detalle: { ...baseDetalle, reason: 'otros_dni_detectados' }
    };
  }

  return {
    status: 'ilegible',
    match: false,
    confianza: 0.1,
    dniDetectado: null,
    candidatos: [],
    ocrText: text,
    detalle: { ...baseDetalle, reason: 'sin_patron_dni' }
  };
}

export function ocrPayloadFromResult(result: IdentidadOcrResult, atIso = new Date().toISOString()) {
  return {
    identidad_ocr_status: result.status,
    identidad_ocr_match: result.match,
    identidad_ocr_confianza: Math.round(result.confianza * 1000) / 1000,
    identidad_ocr_dni_detectado: result.dniDetectado,
    identidad_ocr_at: atIso,
    identidad_ocr_detalle: result.detalle
  };
}
