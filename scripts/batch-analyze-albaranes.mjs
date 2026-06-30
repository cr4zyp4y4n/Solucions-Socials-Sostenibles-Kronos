import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { createCanvas } from '@napi-rs/canvas';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createWorker } from 'tesseract.js';
import { parseAlbaranText } from '../src/services/obradorAlbaranParser.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const albaranesDir = process.argv[2] || 'C:\\Users\\brian\\Downloads\\Albaranes';
const outPath = path.join(__dirname, '..', 'albaranes-batch-report.txt');
const samplesDir = path.join(__dirname, '..', 'albaranes-ocr-samples');

async function extractNativeText(pdf, maxPages = 2) {
  const parts = [];
  for (let p = 1; p <= Math.min(maxPages, pdf.numPages); p += 1) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const pageText = content.items
      .filter((it) => typeof it.str === 'string')
      .map((it) => it.str + (it.hasEOL ? '\n' : ' '))
      .join('')
      .replace(/[ \t]+\n/g, '\n')
      .trim();
    if (pageText) parts.push(pageText);
  }
  return parts.join('\n\n').trim();
}

async function ocrPdfPage(pdf, worker, pageNum = 1) {
  const page = await pdf.getPage(pageNum);
  const viewport = page.getViewport({ scale: 2.5 });
  const canvas = createCanvas(viewport.width, viewport.height);
  const ctx = canvas.getContext('2d');
  await page.render({ canvasContext: ctx, viewport }).promise;
  const tmp = path.join(os.tmpdir(), `albaran-ocr-${Date.now()}.png`);
  fs.writeFileSync(tmp, canvas.toBuffer('image/png'));
  try {
    const { data: { text } } = await worker.recognize(tmp);
    return text.trim();
  } finally {
    try { fs.unlinkSync(tmp); } catch { /* ignore */ }
  }
}

async function getPdfText(pdfPath, worker) {
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const pdf = await pdfjsLib.getDocument({ data, useSystemFonts: true }).promise;
  const native = await extractNativeText(pdf);
  if (native.length >= 80) {
    return { text: native, source: 'native' };
  }
  const ocr = await ocrPdfPage(pdf, worker, 1);
  return { text: ocr, source: 'ocr' };
}

function guessProveidorFromName(name) {
  const n = name.toUpperCase();
  if (n.includes('BEGUDES')) return 'begudes';
  if (n.includes('JOTRI')) return 'jotri';
  if (n.includes('DISTRIBUCIONDEPANIBOLLERIA') || n.includes('ALVILARDAN')) return 'alvilardan';
  if (n.includes('MULTIEMBALAJES')) return 'multiembalajes';
  if (n.includes('TRANSGOURMET')) return 'transgourmet?';
  if (n.includes('MAKRO')) return 'makro?';
  if (n.includes('TROSDORDAL')) return 'trosdordal?';
  if (n.includes('CALVALL')) return 'calvall?';
  if (n.includes('CAFESCANDELAS')) return 'cafescandelas?';
  if (n.includes('LACHIAPANECAS')) return 'lachiapanecas?';
  if (n.includes('HEINDEPOORTER')) return 'heinde?';
  if (n.includes('DESINFECCIONESCEC')) return 'desinfecciones?';
  if (n.includes('KINTO')) return 'kinto?';
  if (n.includes('ORANGE') || n.includes('ENDESA') || n.includes('PARKING')) return 'no-alimentari';
  return 'desconegut';
}

const files = fs.readdirSync(albaranesDir).filter((f) => /\.pdf$/i.test(f)).sort();
if (!fs.existsSync(samplesDir)) fs.mkdirSync(samplesDir, { recursive: true });

const worker = await createWorker('spa+eng');
const lines = [`=== ANÀLISI ALBARANS (${files.length} PDFs) ===`, `Carpeta: ${albaranesDir}`, ''];

for (const file of files) {
  const full = path.join(albaranesDir, file);
  let text = '';
  let source = '';
  try {
    const result = await getPdfText(full, worker);
    text = result.text;
    source = result.source;
    const sampleName = file.replace(/\.pdf$/i, '.txt');
    fs.writeFileSync(path.join(samplesDir, sampleName), text, 'utf8');
  } catch (e) {
    lines.push(`\n## ${file}`);
    lines.push(`ERROR: ${e.message}`);
    continue;
  }

  const parsed = parseAlbaranText(text);
  const guess = guessProveidorFromName(file);

  lines.push(`\n## ${file}`);
  lines.push(`Font: ${source} (${text.length} chars) | Nom → ${guess}`);
  lines.push(`Parser → ${parsed.parserId} (${parsed.confiança})`);
  lines.push(`Lot: ${parsed.lotProveidor || '—'} | Data: ${parsed.dataDocument || '—'} | CIF: ${parsed.proveidorCif || '—'}`);
  lines.push(`Línies: ${parsed.linies?.length || 0} | Notes: ${(parsed.notes || []).join(' · ') || '—'}`);
  lines.push(`Mostra: ${text.replace(/\s+/g, ' ').slice(0, 200)}...`);
  if (parsed.parserId === 'generic') {
    lines.push('⚠ CAP PARSER ESPECÍFIC — cal implementar');
  } else if (!parsed.lotProveidor) {
    lines.push('⚠ Parser detectat però falta nº albarà');
  }
}

await worker.terminate();
const report = lines.join('\n');
fs.writeFileSync(outPath, report, 'utf8');
console.log(report);
console.log(`\nInforme: ${outPath}`);
console.log(`Mostres OCR: ${samplesDir}`);
