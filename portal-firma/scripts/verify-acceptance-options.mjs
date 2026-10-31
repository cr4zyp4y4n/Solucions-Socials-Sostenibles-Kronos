import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const acceptPath = path.join(root, 'app/firmar/[token]/accept/route.ts');
const opcionesPath = path.join(root, 'lib/firmaDocumentoOpciones.ts');

const accept = fs.readFileSync(acceptPath, 'utf8');
const opciones = fs.readFileSync(opcionesPath, 'utf8');

function assert(condition, message) {
  if (!condition) {
    console.error(`ERROR: ${message}`);
    process.exitCode = 1;
  }
}

assert(
  !/normalizeRespuestaAceptacion\([^)]*\)\s*\|\|\s*['"]si['"]/.test(accept),
  'accept/route.ts no debe convertir respuestas ausentes en "si".'
);
assert(
  accept.includes('buildDeclaracionesAceptadas(resolved.documentos)'),
  'accept/route.ts debe prevalidar declaraciones antes de sellar documentos.'
);
assert(
  accept.indexOf('buildDeclaracionesAceptadas(resolved.documentos)') < accept.indexOf('const signedPaths'),
  'La prevalidacion de declaraciones debe ocurrir antes de subir PDFs firmados.'
);
assert(
  accept.includes('getReadStatementNo(d.tipo_documento)'),
  'La auditoria final debe registrar la declaracion negativa cuando la respuesta es "no".'
);
assert(
  opciones.includes(".from('firma_auditorias')") &&
    opciones.includes("det.accion !== 'documento_lectura_confirmada'") &&
    opciones.includes('loadDocumentoOpcionesFromAudit(documentoId)'),
  'loadDocumentoOpciones debe recuperar la respuesta desde la auditoria de lectura si falta opciones_aceptacion.'
);

if (!process.exitCode) {
  console.log('OK: verificaciones de opciones de aceptacion superadas.');
}
