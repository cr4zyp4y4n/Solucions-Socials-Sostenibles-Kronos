/**
 * Vista previa local de la hoja de evidencias (sin SMS, sin portal, sin P12).
 * Uso: npx tsx scripts/preview-evidence-page.ts
 * Abre: tmp-seal-test/preview-evidencias.pdf
 */
import fs from 'fs';
import path from 'path';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { sealPdfWithEvidence } from '../lib/pdfSign';

async function main() {
  // Sin P12 → modo evidencias sin PAdES (igual que producción actual)
  delete process.env.KRONOS_SEAL_P12_BASE64;
  delete process.env.KRONOS_SEAL_P12_BASE64_SOLUCIONS;
  delete process.env.KRONOS_SEAL_P12_BASE64_SOLUCIONS_1;
  delete process.env.KRONOS_SEAL_P12_PASS;
  delete process.env.KRONOS_SEAL_P12_PASS_SOLUCIONS;

  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  page.drawText('Documento de ejemplo (pagina 1 de 2)', { x: 50, y: 780, size: 14, font });
  page.drawText('Pie del documento original — no debe taparse', { x: 50, y: 40, size: 9, font });
  const page2 = doc.addPage([595.28, 841.89]);
  page2.drawText('Documento de ejemplo (pagina 2 de 2)', { x: 50, y: 780, size: 14, font });
  const original = await doc.save();

  const result = await sealPdfWithEvidence({
    pdfBytes: original,
    tipoDocumento: 'riesgos_laborales',
    opciones: { respuesta: 'si', lectura_confirmada: true },
    documentoId: '11111111-2222-3333-4444-555555555555',
    tokenRowId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    nowIso: new Date().toISOString(),
    ip: '203.0.113.10',
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 CriOS/120.0.0.0 Mobile/15E148',
    trabajadorNombre: 'Persona de Prueba',
    trabajadorDni: '12345678Z',
    telefonoOtp: '+34612345412',
    dniConfirmadoEnPortal: true,
    identidadFotoAt: new Date().toISOString(),
    smsVerificadoAt: new Date().toISOString(),
    entityKey: 'EI_SSS',
    documentoTitulo: 'Acuse de recibo informacion RPT (art. 18 LPRL)',
    fileName: 'ejemplo-rpt.pdf'
  });

  const outDir = path.join(__dirname, '..', 'tmp-seal-test');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `preview-evidencias-${Date.now()}.pdf`);
  fs.writeFileSync(outPath, Buffer.from(result.signedPdf));

  console.log(JSON.stringify({ ok: true, outPath, pages: result.originalPageCount + 1, padesSealed: result.padesSealed }, null, 2));

  // Abrir en el visor por defecto (Windows)
  try {
    const { execFileSync } = await import('child_process');
    execFileSync('cmd', ['/c', 'start', '', outPath], { stdio: 'ignore' });
  } catch {
    console.log('Abre manualmente:', outPath);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
