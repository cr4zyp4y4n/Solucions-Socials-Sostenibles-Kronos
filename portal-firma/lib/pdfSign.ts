import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

type StampArgs = {
  pdfBytes: Uint8Array;
  stampLines: string[];
};

export async function stampPdfLastPage({ pdfBytes, stampLines }: StampArgs) {
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const pages = pdfDoc.getPages();
  if (!pages.length) {
    throw new Error('PDF sin páginas');
  }

  const page = pages[pages.length - 1];
  const { width } = page.getSize();

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Compacto: que no "mate" la última página
  const margin = 22;
  const lineGap = 10;
  const headerSize = 9;
  const textSize = 7.5;

  const boxWidth = Math.min(420, width - margin * 2);
  const boxX = margin;
  const boxY = margin;
  const maxLines = 10;
  const lines = stampLines.slice(0, maxLines);
  const boxHeight = 20 + lines.length * lineGap + 12;

  // Caja semitransparente
  page.drawRectangle({
    x: boxX,
    y: boxY,
    width: boxWidth,
    height: boxHeight,
    color: rgb(0.95, 0.99, 0.96),
    borderColor: rgb(0.12, 0.55, 0.3),
    borderWidth: 1
  });

  page.drawText('Aceptación electrónica (Kronos)', {
    x: boxX + 10,
    y: boxY + boxHeight - 14,
    size: headerSize,
    font: fontBold,
    color: rgb(0.12, 0.55, 0.3)
  });

  let y = boxY + boxHeight - 26;
  for (const line of lines) {
    page.drawText(line, {
      x: boxX + 10,
      y,
      size: textSize,
      font,
      color: rgb(0.1, 0.1, 0.1)
    });
    y -= lineGap;
  }

  const out = await pdfDoc.save();
  return new Uint8Array(out);
}

