/**
 * Conversión de coordenadas overlay (canvas pdf.js) ↔ PDF user space (pdf-lib).
 * Usar siempre viewport.convertToPdfPoint / convertToViewportPoint para
 * respetar rotación, CropBox y MediaBox (el cálculo manual left/scale falla en muchos PDFs).
 */

/** Rectángulo en pantalla (origen arriba-izquierda del canvas) → PDF (origen abajo-izquierda). */
export function screenRectToPdf(box, pageIndex, viewport) {
  if (!box || !viewport) return null;
  const left = Number(box.left);
  const top = Number(box.top);
  const width = Number(box.width);
  const height = Number(box.height);
  if (![left, top, width, height].every((n) => Number.isFinite(n))) return null;

  const [x1, y1] = viewport.convertToPdfPoint(left, top);
  const [x2, y2] = viewport.convertToPdfPoint(left + width, top + height);
  const x = Math.min(x1, x2);
  const y = Math.min(y1, y2);
  const w = Math.abs(x2 - x1);
  const h = Math.abs(y2 - y1);

  return {
    pageIndex: Math.floor(Number(pageIndex)) || 0,
    x: Math.round(x * 10) / 10,
    y: Math.round(y * 10) / 10,
    width: Math.round(w * 10) / 10,
    height: Math.round(h * 10) / 10
  };
}

/** Rectángulo PDF → overlay canvas (origen arriba-izquierda). */
export function pdfRectToScreen(saved, viewport) {
  if (!saved || !viewport) return null;
  const x = Number(saved.x);
  const y = Number(saved.y);
  const width = Number(saved.width);
  const height = Number(saved.height);
  if (![x, y, width, height].every((n) => Number.isFinite(n))) return null;

  const [v1x, v1y] = viewport.convertToViewportPoint(x, y);
  const [v2x, v2y] = viewport.convertToViewportPoint(x + width, y + height);

  return {
    left: Math.min(v1x, v2x),
    top: Math.min(v1y, v2y),
    width: Math.abs(v2x - v1x),
    height: Math.abs(v2y - v1y)
  };
}
