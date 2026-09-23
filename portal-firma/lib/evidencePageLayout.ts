/**
 * Diseño visual de la hoja de evidencias (marca EISSS / Kronos).
 * Banda izquierda verde, cabecera con logo, bloques tipográficos y caja SHA-256.
 */
import { PDFDocument, PDFFont, PDFPage, PDFImage, rgb, StandardFonts } from 'pdf-lib';
import { LOGO_SSS_EVIDENCE_PNG_BASE64 } from '@/lib/logoSssEvidenceBase64';

/** Verde Solucions / Kronos (#4CAF50) */
export const EISSS_GREEN = rgb(0.298, 0.686, 0.314);
export const EISSS_GREEN_DARK = rgb(0.18, 0.49, 0.2);
export const EISSS_GREEN_SOFT = rgb(0.91, 0.96, 0.91);
export const INK = rgb(0.12, 0.14, 0.13);
export const MUTED = rgb(0.35, 0.4, 0.38);

export type EvidenceSection = {
  heading: string;
  lines: string[];
};

function toWinAnsiSafe(text: string): string {
  return String(text || '')
    .replace(/\u2022/g, '·')
    .replace(/\u2026/g, '...')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u00A0/g, ' ');
}

function wrapLine(text: string, maxChars: number): string[] {
  const t = String(text || '');
  if (!t) return [];
  if (t.length <= maxChars) return [t];
  const out: string[] = [];
  for (let i = 0; i < t.length; i += maxChars) out.push(t.slice(i, i + maxChars));
  return out;
}

async function tryEmbedLogo(pdfDoc: PDFDocument): Promise<PDFImage | null> {
  try {
    const bytes = Buffer.from(LOGO_SSS_EVIDENCE_PNG_BASE64, 'base64');
    return await pdfDoc.embedPng(bytes);
  } catch {
    return null;
  }
}

function drawWordmark(page: PDFPage, fontBold: PDFFont, x: number, y: number): number {
  const box = 36;
  page.drawRectangle({
    x,
    y: y - box,
    width: box,
    height: box,
    color: EISSS_GREEN
  });
  page.drawText('SSS', {
    x: x + 5,
    y: y - 24,
    size: 12,
    font: fontBold,
    color: rgb(1, 1, 1)
  });
  return box;
}

export async function drawBrandedEvidencePage({
  pdfDoc,
  page,
  width,
  height,
  razonSocial,
  nif,
  sections,
  sha256Original,
  padesSealed
}: {
  pdfDoc: PDFDocument;
  page: PDFPage;
  width: number;
  height: number;
  razonSocial: string;
  nif: string;
  sections: EvidenceSection[];
  sha256Original: string;
  padesSealed: boolean;
}): Promise<void> {
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const logo = await tryEmbedLogo(pdfDoc);

  const leftBar = 10;
  const marginL = 36 + leftBar;
  const marginR = 36;
  const marginT = 36;
  const contentW = width - marginL - marginR;

  page.drawRectangle({
    x: 0,
    y: 0,
    width,
    height,
    color: rgb(0.985, 0.99, 0.985)
  });

  page.drawRectangle({
    x: 0,
    y: 0,
    width: leftBar,
    height,
    color: EISSS_GREEN
  });

  const headerH = 72;
  page.drawRectangle({
    x: leftBar,
    y: height - headerH,
    width: width - leftBar,
    height: headerH,
    color: EISSS_GREEN_SOFT
  });
  page.drawRectangle({
    x: leftBar,
    y: height - headerH,
    width: width - leftBar,
    height: 2.5,
    color: EISSS_GREEN
  });

  let brandX = marginL;
  if (logo) {
    const logoW = 52;
    const logoH = (logo.height / logo.width) * logoW;
    page.drawImage(logo, {
      x: marginL,
      y: height - marginT - logoH + 4,
      width: logoW,
      height: logoH
    });
    brandX = marginL + logoW + 12;
  } else {
    drawWordmark(page, fontBold, marginL, height - marginT + 8);
    brandX = marginL + 48;
  }

  page.drawText(toWinAnsiSafe(razonSocial), {
    x: brandX,
    y: height - 32,
    size: 11,
    font: fontBold,
    color: EISSS_GREEN_DARK
  });
  const sub = nif
    ? `NIF ${nif}  ·  Kronos · Acuse electrónico`
    : 'Kronos · Acuse electrónico';
  page.drawText(toWinAnsiSafe(sub), {
    x: brandX,
    y: height - 48,
    size: 8,
    font,
    color: MUTED
  });

  let y = height - headerH - 28;
  page.drawText(toWinAnsiSafe('Hoja de evidencias de aceptación electrónica'), {
    x: marginL,
    y,
    size: 14,
    font: fontBold,
    color: INK
  });
  y -= 8;
  page.drawRectangle({
    x: marginL,
    y: y - 2,
    width: 120,
    height: 2.5,
    color: EISSS_GREEN
  });
  y -= 22;

  const bodySize = 9;
  const labelSize = 8;
  const lineGap = 11;
  const maxChars = Math.floor(contentW / (bodySize * 0.48));

  for (const section of sections) {
    if (y < 100) break;

    page.drawRectangle({
      x: marginL,
      y: y - 2,
      width: 3,
      height: 11,
      color: EISSS_GREEN
    });
    page.drawText(toWinAnsiSafe(section.heading.toUpperCase()), {
      x: marginL + 10,
      y,
      size: labelSize,
      font: fontBold,
      color: EISSS_GREEN_DARK
    });
    y -= 14;

    for (const raw of section.lines) {
      if (!raw) {
        y -= 4;
        continue;
      }
      for (const line of wrapLine(toWinAnsiSafe(raw), Math.max(40, maxChars))) {
        if (y < 90) break;
        page.drawText(line, {
          x: marginL + 10,
          y,
          size: bodySize,
          font,
          color: INK
        });
        y -= lineGap;
      }
    }
    y -= 8;
  }

  const shaLines = wrapLine(sha256Original, 64);
  const shaBoxH = 28 + shaLines.length * 11;
  if (y - shaBoxH > 48) {
    y -= 4;
    page.drawRectangle({
      x: marginL,
      y: y - shaBoxH,
      width: contentW,
      height: shaBoxH,
      color: EISSS_GREEN_SOFT,
      borderColor: EISSS_GREEN,
      borderWidth: 1
    });
    page.drawRectangle({
      x: marginL,
      y: y - shaBoxH,
      width: 4,
      height: shaBoxH,
      color: EISSS_GREEN
    });
    page.drawText('SHA-256 DEL PDF ORIGINAL', {
      x: marginL + 14,
      y: y - 14,
      size: 7.5,
      font: fontBold,
      color: EISSS_GREEN_DARK
    });
    let sy = y - 28;
    for (const line of shaLines) {
      page.drawText(line, {
        x: marginL + 14,
        y: sy,
        size: 8,
        font,
        color: INK
      });
      sy -= 11;
    }
  }

  page.drawRectangle({
    x: leftBar,
    y: 0,
    width: width - leftBar,
    height: 28,
    color: EISSS_GREEN_DARK
  });
  const footer = padesSealed
    ? 'Documento con sello electrónico de la entidad  ·  Generado por Kronos'
    : 'Aceptación electrónica verificada por SMS  ·  Sello PAdES pendiente  ·  Kronos';
  page.drawText(toWinAnsiSafe(footer), {
    x: marginL,
    y: 10,
    size: 7.5,
    font,
    color: rgb(0.95, 0.98, 0.95)
  });
}
