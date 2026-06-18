import { createWorker } from 'tesseract.js';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

function isPdfFile(file) {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '');
}

async function runWithProgress(task, onProgress) {
  if (!onProgress) return task();
  let pct = 5;
  onProgress(pct);
  const id = setInterval(() => {
    pct = Math.min(pct + 5, 90);
    onProgress(pct);
  }, 350);
  try {
    return await task();
  } finally {
    clearInterval(id);
    onProgress(100);
  }
}

async function loadPdf(file) {
  const data = await file.arrayBuffer();
  return pdfjsLib.getDocument({ data }).promise;
}

async function extractPdfNativeText(pdf, maxPages) {
  const parts = [];
  for (let pageNum = 1; pageNum <= maxPages; pageNum += 1) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const pageText = content.items
      .filter((it) => typeof it.str === 'string')
      .map((it) => it.str + (it.hasEOL ? '\n' : ' '))
      .join('')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]{2,}/g, ' ')
      .trim();
    if (pageText) parts.push(pageText);
  }
  return parts.join('\n\n').trim();
}

async function ocrPdfPages(pdf, worker, maxPages) {
  const parts = [];
  for (let pageNum = 1; pageNum <= maxPages; pageNum += 1) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: ctx, viewport }).promise;
    const { data: { text } } = await worker.recognize(canvas);
    parts.push(text);
  }
  return parts.join('\n\n');
}

async function textFromPdf(file, worker, onProgress) {
  const pdf = await loadPdf(file);
  const maxPages = Math.min(pdf.numPages, 3);

  const nativeText = await extractPdfNativeText(pdf, maxPages);
  if (nativeText.length >= 80) {
    if (onProgress) onProgress(100);
    return nativeText;
  }

  return runWithProgress(() => ocrPdfPages(pdf, worker, maxPages), onProgress);
}

export async function ocrTextFromAlbaranFile(file, { onProgress } = {}) {
  if (isPdfFile(file)) {
    const worker = await createWorker('spa+eng');
    try {
      return await textFromPdf(file, worker, onProgress);
    } finally {
      await worker.terminate();
    }
  }

  return runWithProgress(async () => {
    const worker = await createWorker('spa+eng');
    try {
      const { data: { text } } = await worker.recognize(file);
      return text;
    } finally {
      await worker.terminate();
    }
  }, onProgress);
}

export { isPdfFile };
