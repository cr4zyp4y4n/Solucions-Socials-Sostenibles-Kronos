'use client';

import { createWorker } from 'tesseract.js';
import { evaluateIdentidadOcr, type IdentidadOcrResult } from '@/lib/dniOcrMatch';

/**
 * OCR en el navegador (Tesseract) sobre la selfie+DNI.
 * No bloquea la firma: es señal para admin.
 */
export async function runIdentidadOcrOnBlob(
  image: Blob | File,
  expectedDni: string | null | undefined,
  onProgress?: (pct: number) => void
): Promise<IdentidadOcrResult> {
  onProgress?.(5);
  const worker = await createWorker('spa+eng');
  try {
    onProgress?.(20);
    const { data } = await worker.recognize(image);
    onProgress?.(100);
    return evaluateIdentidadOcr(data?.text || '', expectedDni, {
      engine: 'tesseract.js',
      lang: 'spa+eng',
      meanConfidence: typeof data?.confidence === 'number' ? data.confidence : null
    });
  } finally {
    await worker.terminate().catch(() => {});
  }
}

/** Envía el texto OCR al servidor para re-evaluar vs DNI de BBDD y persistir. */
export async function postIdentidadOcrResult(
  token: string,
  result: IdentidadOcrResult
): Promise<{ ok: boolean; error?: string; status?: string; match?: boolean }> {
  try {
    const hasText = Boolean(result.ocrText && String(result.ocrText).trim());
    const res = await fetch(`/firmar/${encodeURIComponent(token)}/identidad/ocr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        hasText
          ? {
              ocrText: result.ocrText,
              detalle: result.detalle
            }
          : {
              status: result.status,
              match: result.match,
              confianza: result.confianza,
              dniDetectado: result.dniDetectado,
              candidatos: result.candidatos,
              detalle: result.detalle
            }
      )
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.ok) {
      return { ok: false, error: json.error || 'No se pudo guardar el OCR' };
    }
    return {
      ok: true,
      status: json.status,
      match: json.match
    };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error de red OCR' };
  }
}
