import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const acceptRoute = fs.readFileSync(
  path.join(root, 'app/firmar/[token]/accept/route.ts'),
  'utf8'
);
const opcionesHelper = fs.readFileSync(
  path.join(root, 'lib/firmaDocumentoOpciones.ts'),
  'utf8'
);

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
  }
}

assert(
  !acceptRoute.includes("normalizeRespuestaAceptacion(opciones) || 'si'"),
  'accept route must not default missing acceptance responses to yes'
);

assert(
  acceptRoute.includes('const declaracionesAceptadas = await Promise.all') &&
    acceptRoute.indexOf('const declaracionesAceptadas = await Promise.all') <
      acceptRoute.indexOf('const signedPaths: string[] = []'),
  'accept route must validate declarations before stamping PDFs'
);

assert(
  acceptRoute.includes("if (!respuesta)") &&
    acceptRoute.includes('Falta una respuesta') &&
    acceptRoute.includes('declaraciones_aceptadas: declaracionesAceptadas') &&
    acceptRoute.includes('getReadStatementNo(d.tipo_documento)'),
  'accept route must block and audit only verifiable yes/no responses'
);

assert(
  opcionesHelper.includes('loadRespuestaFromAuditoria') &&
    opcionesHelper.includes("detalle?.accion !== 'documento_lectura_confirmada'") &&
    opcionesHelper.includes('opciones: await loadRespuestaFromAuditoria(documentoId)'),
  'options helper must recover acceptance responses from read-confirmation audit rows'
);

if (process.exitCode) {
  process.exit(process.exitCode);
}

console.log('Acceptance options regression checks passed.');
