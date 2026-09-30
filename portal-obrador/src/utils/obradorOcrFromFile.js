import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { setObradorPdfWorkerSrc } from '../../../shared/obrador/ocrFromFile.js';

setObradorPdfWorkerSrc(pdfjsWorker);

/** Reexport compartit — editar a shared/obrador/ocrFromFile.js */
export * from '../../../shared/obrador/ocrFromFile.js';
