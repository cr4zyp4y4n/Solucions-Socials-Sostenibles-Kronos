import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const read = (rel) => readFileSync(join(root, rel), 'utf8');

const acceptRoute = read('app/firmar/[token]/accept/route.ts');
const opcionesHelper = read('lib/firmaDocumentoOpciones.ts');
const tokenResolver = read('lib/resolveFirmaToken.ts');

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
  }
}

assert(
  !/normalizeRespuestaAceptacion\([^)]*\)\s*\|\|\s*['"]si['"]/.test(acceptRoute),
  'accept route must not default missing acceptance options to "si"'
);
assert(
  acceptRoute.includes('missingDeclaraciones') &&
    acceptRoute.includes('Debes indicar Sí o No') &&
    acceptRoute.indexOf('missingDeclaraciones') < acceptRoute.lastIndexOf('stampAndUploadDocument({'),
  'accept route must validate every Si/No answer before sealing PDFs'
);
assert(
  acceptRoute.includes('getReadStatementNo') &&
    acceptRoute.includes('buildAceptacionRespuestaLine(d.tipo_documento, respuesta)'),
  'accept route must audit negative answers with the explicit No declaration'
);
assert(
  opcionesHelper.includes("accion !== 'documento_lectura_confirmada'") &&
    opcionesHelper.includes(".from('firma_auditorias')") &&
    opcionesHelper.includes('loadOpcionesFromAudit(documentoId)'),
  'firmaDocumentoOpciones must recover saved Si/No decisions from lectura audit rows'
);
assert(
  tokenResolver.includes('isMissingOpcionesColumn') &&
    tokenResolver.includes('select(tokenSelect(false))') &&
    tokenResolver.includes('select(documentosSelect(false))'),
  'resolveFirmaToken must retry without opciones_aceptacion when schema cache is stale'
);

if (process.exitCode) {
  process.exit();
}

console.log('OK: acceptance options regression checks passed');
