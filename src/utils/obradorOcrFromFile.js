import { createWorker } from 'tesseract.js';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

function isPdfFile(file) {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '');
}

function buildMeta(file, partial = {}) {
  return {
    fileName: file?.name || '',
    fileType: file?.type || '',
    charCount: 0,
    pageCount: null,
    nativeCharCount: null,
    source: 'desconegut',
    usedJotriRegions: false,
    usedHeaderCrop: false,
    ...partial
  };
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

async function renderPageToCanvas(page, scale) {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas;
}

async function ocrCanvasRegion(worker, sourceCanvas, { topRatio = 0, heightRatio = 1, psm = '6' }) {
  const srcH = sourceCanvas.height;
  const cropY = Math.floor(srcH * topRatio);
  const cropH = Math.max(1, Math.floor(srcH * heightRatio));
  const canvas = document.createElement('canvas');
  canvas.width = sourceCanvas.width;
  canvas.height = cropH;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(
    sourceCanvas,
    0, cropY, sourceCanvas.width, cropH,
    0, 0, sourceCanvas.width, cropH
  );
  await worker.setParameters({ tessedit_pageseg_mode: psm });
  const { data: { text } } = await worker.recognize(canvas);
  return text;
}

async function ocrPdfPagesFull(pdf, worker, maxPages) {
  const parts = [];
  for (let pageNum = 1; pageNum <= maxPages; pageNum += 1) {
    const page = await pdf.getPage(pageNum);
    const canvas = await renderPageToCanvas(page, 2.5);
    const { data: { text } } = await worker.recognize(canvas);
    parts.push(text.trim());
  }
  return parts.filter(Boolean).join('\n\n');
}

async function ocrPdfPagesJotriRegions(pdf, worker, maxPages) {
  const parts = [];
  for (let pageNum = 1; pageNum <= maxPages; pageNum += 1) {
    const page = await pdf.getPage(pageNum);
    const canvas = await renderPageToCanvas(page, 4);
    const metaBlock = await ocrCanvasRegion(worker, canvas, { topRatio: 0, heightRatio: 0.45, psm: '11' });
    const metaRow = await ocrCanvasRegion(worker, canvas, { topRatio: 0.14, heightRatio: 0.32, psm: '7' });
    const body = await ocrCanvasRegion(worker, canvas, { topRatio: 0.36, heightRatio: 0.64, psm: '6' });
    parts.push(
      '###JOTRI_META###',
      metaBlock.trim(),
      metaRow.trim(),
      '###JOTRI_BODY###',
      body.trim()
    );
  }
  return parts.filter(Boolean).join('\n');
}

async function fileToCanvas(file) {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close?.();
  return canvas;
}

async function ocrImageFile(worker, file) {
  const canvas = await fileToCanvas(file);
  const { data: { text: fullText } } = await worker.recognize(canvas);
  const headerText = await ocrCanvasRegion(worker, canvas, { topRatio: 0, heightRatio: 0.48, psm: '6' });
  const combined = [headerText.trim(), fullText.trim()].filter(Boolean).join('\n');
  return {
    text: combined,
    usedHeaderCrop: headerText.trim().length > 0
  };
}

async function textFromPdf(file, worker, onProgress) {
  const pdf = await loadPdf(file);
  const maxPages = Math.min(pdf.numPages, 3);
  const nativeText = await extractPdfNativeText(pdf, maxPages);

  if (nativeText.length >= 80) {
    if (onProgress) onProgress(100);
    return {
      text: nativeText,
      meta: buildMeta(file, {
        source: 'native-pdf',
        charCount: nativeText.length,
        pageCount: maxPages,
        nativeCharCount: nativeText.length
      })
    };
  }

  const ocrResult = await runWithProgress(async () => {
    const fullText = await ocrPdfPagesFull(pdf, worker, maxPages);
    const jotriText = await ocrPdfPagesJotriRegions(pdf, worker, maxPages);
    const text = [fullText, jotriText].filter(Boolean).join('\n\n');
    return {
      text,
      meta: buildMeta(file, {
        source: 'ocr-pdf',
        charCount: text.length,
        pageCount: maxPages,
        nativeCharCount: nativeText.length,
        usedJotriRegions: true
      })
    };
  }, onProgress);

  return ocrResult;
}

/**
 * OCR o extracció de text des d'imatge o PDF.
 * Retorna { text, meta } per depuració.
 */
export async function ocrTextFromAlbaranFile(file, { onProgress } = {}) {
  if (isPdfFile(file)) {
    const worker = await createWorker('spa+eng');
    try {
      return await textFromPdf(file, worker, onProgress);
    } finally {
      await worker.terminate();
    }
  }

  const result = await runWithProgress(async () => {
    const worker = await createWorker('spa+eng');
    try {
      const { text, usedHeaderCrop } = await ocrImageFile(worker, file);
      return {
        text,
        meta: buildMeta(file, {
          source: 'ocr-image',
          charCount: text.length,
          usedHeaderCrop
        })
      };
    } finally {
      await worker.terminate();
    }
  }, onProgress);

  return result;
}

export { isPdfFile };
