import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath) {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

function assert(condition, message) {
  if (!condition) {
    console.error(`ERROR: ${message}`);
    process.exitCode = 1;
  }
}

const acceptRoute = read('app/firmar/[token]/accept/route.ts');
const opcionesHelper = read('lib/firmaDocumentoOpciones.ts');

assert(
  !acceptRoute.includes("normalizeRespuestaAceptacion(opciones) || 'si'") &&
    !acceptRoute.includes('normalizeRespuestaAceptacion(opciones) || "si"'),
  'accept/route.ts no debe convertir respuestas ausentes en "si" por defecto.'
);

assert(
  acceptRoute.includes('No se puede firmar sin una respuesta Sí/No verificable') &&
    acceptRoute.indexOf('No se puede firmar sin una respuesta Sí/No verificable') <
      acceptRoute.indexOf('const result = await stampAndUploadDocument({'),
  'accept/route.ts debe bloquear respuestas no verificables antes de sellar PDFs.'
);

assert(
  acceptRoute.includes('getReadStatementNo') &&
    acceptRoute.includes('declaracionesAceptadasAudit'),
  'accept/route.ts debe auditar declaraciones negativas sin reescribirlas como aceptación positiva.'
);

assert(
  opcionesHelper.includes(".from('firma_auditorias')") &&
    opcionesHelper.includes("d.accion !== 'documento_lectura_confirmada'") &&
    opcionesHelper.includes('loadOpcionesFromAuditoria(documentoId)'),
  'firmaDocumentoOpciones.ts debe recuperar la respuesta Sí/No desde auditoría si opciones_aceptacion falta o es null.'
);

if (!process.exitCode) {
  console.log('OK: aceptación de firma exige respuesta Sí/No verificable.');
}
