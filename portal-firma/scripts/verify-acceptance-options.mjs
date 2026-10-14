import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const acceptRoute = readFileSync(join(root, 'app/firmar/[token]/accept/route.ts'), 'utf8');
const opcionesLib = readFileSync(join(root, 'lib/firmaDocumentoOpciones.ts'), 'utf8');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

assert(
  !/normalizeRespuestaAceptacion\([^)]*\)\s*\|\|\s*['"]si['"]/.test(acceptRoute),
  'accept/route.ts must not default a missing acceptance response to "si".'
);

assert(
  acceptRoute.includes('getReadStatementNo') && acceptRoute.includes('declaracionesAceptadas'),
  'accept/route.ts must build audited declarations from verified Si/No responses.'
);

const validationIndex = acceptRoute.indexOf('const declaracionesAceptadas = await Promise.all');
const sealIndex = acceptRoute.indexOf('const signedPaths: string[] = []');
assert(validationIndex !== -1, 'accept/route.ts must validate declarations before signing.');
assert(sealIndex !== -1, 'accept/route.ts signing block was not found.');
assert(validationIndex < sealIndex, 'accept/route.ts must validate declarations before sealing PDFs.');

assert(
  opcionesLib.includes('loadOpcionesFromAudit') &&
    opcionesLib.includes("detalle?.accion !== 'documento_lectura_confirmada'"),
  'firmaDocumentoOpciones.ts must recover acceptance responses from document review audit.'
);

console.log('Acceptance option regression checks passed.');
