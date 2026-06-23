import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createCanvas } from '@napi-rs/canvas';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createWorker } from 'tesseract.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const pdfPath = path.join(root, 'MULTIEMBALAJES.pdf');
const outPath = path.join(root, 'MULTIEMBALAJES_ocr_sample.txt');

const data = new Uint8Array(fs.readFileSync(pdfPath));
const pdf = await pdfjsLib.getDocument({ data, useSystemFonts: true }).promise;
const page = await pdf.getPage(1);
const viewport = page.getViewport({ scale: 2.5 });

const canvas = createCanvas(viewport.width, viewport.height);
const ctx = canvas.getContext('2d');
await page.render({ canvasContext: ctx, viewport }).promise;

const png = canvas.toBuffer('image/png');
const worker = await createWorker('spa+eng');
const { data: { text } } = await worker.recognize(png);
await worker.terminate();

fs.writeFileSync(outPath, text, 'utf8');
console.log(text);
