/**
 * Smoke test local: hoja de evidencias + PAdES con P12 de desarrollo.
 * Uso: npx tsx scripts/smoke-seal-pades.ts
 */
import fs from 'fs';
import path from 'path';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { sealPdfWithEvidence } from '../lib/pdfSign';

async function main() {
  const p12Path = path.join(__dirname, '..', 'tmp-seal-test', 'dev.p12');
  if (!fs.existsSync(p12Path)) {
    throw new Error('Falta tmp-seal-test/dev.p12 (generar antes)');
  }
  process.env.KRONOS_SEAL_P12_BASE64 = fs.readFileSync(p12Path).toString('base64');
  process.env.KRONOS_SEAL_P12_PASS = 'devpass';

  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  page.drawText('Documento prueba Kronos PAdES', { x: 50, y: 780, size: 14, font });
  page.drawText('Pie de pagina del servicio de prevencion (no debe taparse)', {
    x: 50,
    y: 40,
    size: 9,
    font
  });
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
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    trabajadorNombre: 'Persona de Prueba',
    trabajadorDni: '12345678Z',
    telefonoOtp: '+34612345412',
    dniConfirmadoEnPortal: true,
    identidadFotoAt: new Date().toISOString(),
    smsVerificadoAt: new Date().toISOString(),
    entityKey: 'EI_SSS',
    documentoTitulo: 'Ficha informativa de riesgos especificos del puesto'
  });

  const outPath = path.join(__dirname, '..', 'tmp-seal-test', 'sealed-smoke.pdf');
  fs.writeFileSync(outPath, Buffer.from(result.signedPdf));

  const sealedDoc = await PDFDocument.load(result.signedPdf);
  console.log(
    JSON.stringify(
      {
        ok: true,
        pages: sealedDoc.getPageCount(),
        originalPageCount: result.originalPageCount,
        sha256Original: result.sha256Original,
        sha256Firmado: result.sha256Firmado,
        sealCertSerial: result.sealCertSerial,
        sealCertIssuer: result.sealCertIssuer,
        outPath
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
