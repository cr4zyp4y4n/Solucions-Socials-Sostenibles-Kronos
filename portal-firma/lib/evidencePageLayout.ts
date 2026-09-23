/**
 * Diseño visual de la hoja de evidencias (marca EISSS / Kronos).
 * Estilo documental formal: logo alineado, tipografía sobria, menos “plantilla verde”.
 */
import { PDFDocument, PDFFont, PDFPage, PDFImage, rgb, StandardFonts } from 'pdf-lib';
import { LOGO_SSS_EVIDENCE_PNG_BASE64 } from '@/lib/logoSssEvidenceBase64';

/** Verde Solucions / Kronos (#4CAF50) */
export const EISSS_GREEN = rgb(0.298, 0.686, 0.314);
export const EISSS_GREEN_DARK = rgb(0.15, 0.42, 0.18);
export const RULE = rgb(0.78, 0.82, 0.79);
export const INK = rgb(0.1, 0.12, 0.11);
export const MUTED = rgb(0.38, 0.42, 0.4);

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

/** Parte "Etiqueta: valor" para filas tipo ficha. */
function splitLabelValue(line: string): { label: string; value: string } | null {
  const idx = line.indexOf(':');
  if (idx <= 0 || idx > 42) return null;
  return {
    label: line.slice(0, idx).trim(),
    value: line.slice(idx + 1).trim()
  };
}

async function tryEmbedLogo(pdfDoc: PDFDocument): Promise<PDFImage | null> {
  try {
    const bytes = Buffer.from(LOGO_SSS_EVIDENCE_PNG_BASE64, 'base64');
    return await pdfDoc.embedPng(bytes);
  } catch {
    return null;
  }
}

function drawWordmark(page: PDFPage, fontBold: PDFFont, x: number, midY: number): number {
  const box = 32;
  page.drawRectangle({
    x,
    y: midY - box / 2,
    width: box,
    height: box,
    color: EISSS_GREEN_DARK
  });
  page.drawText('SSS', {
    x: x + 4.5,
    y: midY - 4.5,
    size: 11,
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

  const leftBar = 6;
  const marginL = 40 + leftBar;
  const marginR = 40;
  const contentW = width - marginL - marginR;
  const footerH = 22;

  // Fondo blanco limpio
  page.drawRectangle({
    x: 0,
    y: 0,
    width,
    height,
    color: rgb(1, 1, 1)
  });

  // Filete izquierdo fino
  page.drawRectangle({
    x: 0,
    y: footerH,
    width: leftBar,
    height: height - footerH,
    color: EISSS_GREEN_DARK
  });

  // —— Cabecera institucional ——
  const headerH = 58;
  const headerBottom = height - headerH;
  const headerMid = headerBottom + headerH / 2;

  // Solo línea superior + línea de cierre (sin fondo verde suave)
  page.drawRectangle({
    x: leftBar,
    y: height - 3,
    width: width - leftBar,
    height: 3,
    color: EISSS_GREEN_DARK
  });
  page.drawRectangle({
    x: leftBar,
    y: headerBottom,
    width: width - leftBar,
    height: 0.75,
    color: RULE
  });

  let brandX = marginL;
  if (logo) {
    const logoW = 38;
    const logoH = (logo.height / logo.width) * logoW;
    page.drawImage(logo, {
      x: marginL,
      y: headerMid - logoH / 2,
      width: logoW,
      height: logoH
    });
    brandX = marginL + logoW + 12;
  } else {
    const box = drawWordmark(page, fontBold, marginL, headerMid);
    brandX = marginL + box + 12;
  }

  // Bloque de texto centrado verticalmente con el logo
  const titleSize = 10;
  const metaSize = 8;
  const gap = 3;
  const textBlockH = titleSize + gap + metaSize;
  const textTop = headerMid + textBlockH / 2;

  page.drawText(toWinAnsiSafe(razonSocial), {
    x: brandX,
    y: textTop - titleSize,
    size: titleSize,
    font: fontBold,
    color: INK
  });
  const metaLine = nif
    ? `NIF ${nif}   ·   Kronos · Acuse electrónico`
    : 'Kronos · Acuse electrónico';
  page.drawText(toWinAnsiSafe(metaLine), {
    x: brandX,
    y: textTop - titleSize - gap - metaSize,
    size: metaSize,
    font,
    color: MUTED
  });

  // —— Título del documento ——
  let y = headerBottom - 26;
  page.drawText(toWinAnsiSafe('Hoja de evidencias de aceptación electrónica'), {
    x: marginL,
    y,
    size: 13,
    font: fontBold,
    color: INK
  });
  y -= 6;
  page.drawRectangle({
    x: marginL,
    y: y - 1,
    width: 56,
    height: 1.5,
    color: EISSS_GREEN_DARK
  });
  y -= 20;

  const bodySize = 9;
  const labelSize = 8;
  const lineGap = 12;
  const labelColW = 148;
  const valueMaxChars = Math.floor((contentW - labelColW - 8) / (bodySize * 0.5));

  for (const section of sections) {
    if (y < footerH + 90) break;

    page.drawText(toWinAnsiSafe(section.heading.toUpperCase()), {
      x: marginL,
      y,
      size: labelSize,
      font: fontBold,
      color: EISSS_GREEN_DARK
    });
    y -= 5;
    page.drawRectangle({
      x: marginL,
      y: y - 0.5,
      width: contentW,
      height: 0.5,
      color: RULE
    });
    y -= 14;

    for (const raw of section.lines) {
      if (!raw) {
        y -= 3;
        continue;
      }
      if (y < footerH + 80) break;

      const parts = splitLabelValue(raw);
      if (parts) {
        page.drawText(toWinAnsiSafe(parts.label), {
          x: marginL,
          y,
          size: bodySize,
          font,
          color: MUTED
        });
        const valueLines = wrapLine(toWinAnsiSafe(parts.value), Math.max(28, valueMaxChars));
        let vx = 0;
        for (const vl of valueLines) {
          page.drawText(vl, {
            x: marginL + labelColW,
            y: y - vx * lineGap,
            size: bodySize,
            font: fontBold,
            color: INK
          });
          vx += 1;
        }
        y -= Math.max(1, valueLines.length) * lineGap;
      } else {
        for (const line of wrapLine(toWinAnsiSafe(raw), Math.max(48, Math.floor(contentW / (bodySize * 0.5))))) {
          page.drawText(line, {
            x: marginL,
            y,
            size: bodySize,
            font,
            color: INK
          });
          y -= lineGap;
        }
      }
    }
    y -= 10;
  }

  // —— Bloque SHA (sobrio: borde fino, sin relleno chillón) ——
  const shaLines = wrapLine(sha256Original, 64);
  const shaPad = 10;
  const shaBoxH = shaPad * 2 + 12 + shaLines.length * 10;
  if (y - shaBoxH > footerH + 16) {
    y -= 2;
    page.drawRectangle({
      x: marginL,
      y: y - shaBoxH,
      width: contentW,
      height: shaBoxH,
      borderColor: EISSS_GREEN_DARK,
      borderWidth: 0.9,
      color: rgb(0.97, 0.98, 0.97)
    });
    page.drawText('INTEGRIDAD · SHA-256 DEL PDF ORIGINAL', {
      x: marginL + shaPad,
      y: y - shaPad - 8,
      size: 7.5,
      font: fontBold,
      color: EISSS_GREEN_DARK
    });
    let sy = y - shaPad - 22;
    for (const line of shaLines) {
      page.drawText(line, {
        x: marginL + shaPad,
        y: sy,
        size: 8,
        font,
        color: INK
      });
      sy -= 10;
    }
  }

  // —— Pie ——
  page.drawRectangle({
    x: 0,
    y: 0,
    width,
    height: footerH,
    color: EISSS_GREEN_DARK
  });
  const footer = padesSealed
    ? 'Sello electrónico de la entidad aplicado  ·  Generado por Kronos'
    : 'Aceptación verificada por SMS  ·  Sello PAdES pendiente  ·  Kronos';
  page.drawText(toWinAnsiSafe(footer), {
    x: marginL,
    y: 7,
    size: 7.5,
    font,
    color: rgb(0.95, 0.97, 0.95)
  });
}
