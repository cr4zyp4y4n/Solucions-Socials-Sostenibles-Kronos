/**
 * Sello visual mínimo de aceptación (tipo widget de certificado).
 * No sustituye la hoja de evidencias: solo marca nombre, DNI y fecha en el PDF.
 */
import { PDFDocument, PDFPage, rgb, StandardFonts } from 'pdf-lib';
import { formatMadridDateTime } from '@/lib/madridDate';

export type SelloPosicion = {
  pageIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

export const SELLO_DEFAULT_WIDTH = 145;
export const SELLO_DEFAULT_HEIGHT = 38;

const GREEN = rgb(0.15, 0.42, 0.18);
const GREEN_SOFT = rgb(0.94, 0.97, 0.94);
const INK = rgb(0.1, 0.12, 0.11);

function toWinAnsiSafe(text: string): string {
  return String(text || '')
    .replace(/\u2022/g, '·')
    .replace(/\u2026/g, '...')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u00A0/g, ' ');
}

export function normalizeSelloPosicion(raw: unknown): SelloPosicion | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const pageIndex = Number(o.pageIndex);
  const x = Number(o.x);
  const y = Number(o.y);
  const width = Number(o.width);
  const height = Number(o.height);
  if (![pageIndex, x, y, width, height].every((n) => Number.isFinite(n))) return null;
  if (pageIndex < 0 || width < 40 || height < 20) return null;
  return {
    pageIndex: Math.floor(pageIndex),
    x,
    y,
    width: Math.min(Math.max(width, 80), 260),
    height: Math.min(Math.max(height, 28), 70)
  };
}

/** Default: esquina inferior derecha de la última página del original. */
export function defaultSelloPosicion(page: PDFPage): SelloPosicion {
  const { width } = page.getSize();
  const w = SELLO_DEFAULT_WIDTH;
  const h = SELLO_DEFAULT_HEIGHT;
  return {
    pageIndex: 0, // se ajusta al llamar con índice real
    x: Math.max(24, width - w - 28),
    y: 36,
    width: w,
    height: h
  };
}

export async function drawAcceptanceStamp({
  pdfDoc,
  page,
  box,
  trabajadorNombre,
  trabajadorDni,
  nowIso
}: {
  pdfDoc: PDFDocument;
  page: PDFPage;
  box: Pick<SelloPosicion, 'x' | 'y' | 'width' | 'height'>;
  trabajadorNombre?: string | null;
  trabajadorDni?: string | null;
  nowIso: string;
}): Promise<void> {
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const { x, y, width, height } = box;

  page.drawRectangle({
    x,
    y,
    width,
    height,
    color: GREEN_SOFT,
    borderColor: GREEN,
    borderWidth: 0.8
  });

  const padX = 4;
  const padY = 3.5;
  let ty = y + height - padY - 7;

  page.drawText(toWinAnsiSafe('Aceptado · Kronos'), {
    x: x + padX,
    y: ty,
    size: 6.5,
    font: fontBold,
    color: GREEN
  });
  ty -= 9;

  const nombre = toWinAnsiSafe(String(trabajadorNombre || '—').slice(0, 28));
  page.drawText(nombre, {
    x: x + padX,
    y: ty,
    size: 6.5,
    font: fontBold,
    color: INK
  });
  ty -= 8;

  page.drawText(toWinAnsiSafe(`DNI ${trabajadorDni || '—'}`), {
    x: x + padX,
    y: ty,
    size: 6,
    font,
    color: INK
  });
  ty -= 8;

  const fecha = formatMadridDateTime(nowIso) || nowIso;
  page.drawText(toWinAnsiSafe(fecha.slice(0, 32)), {
    x: x + padX,
    y: Math.max(y + padY, ty),
    size: 5.5,
    font,
    color: INK
  });
}
