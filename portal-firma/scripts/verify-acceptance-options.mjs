import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const acceptRoute = readFileSync(resolve(root, 'app/firmar/[token]/accept/route.ts'), 'utf8');
const opcionesLib = readFileSync(resolve(root, 'lib/firmaDocumentoOpciones.ts'), 'utf8');

const failures = [];

if (/normalizeRespuestaAceptacion\([^)]*\)\s*\|\|\s*['"]si['"]/.test(acceptRoute)) {
  failures.push('accept/route.ts no debe convertir una respuesta no verificable en "si".');
}

if (!acceptRoute.includes('documentosSinRespuesta.length')) {
  failures.push('accept/route.ts debe bloquear la firma cuando falte una respuesta Sí/No verificable.');
}

if (!opcionesLib.includes('loadOpcionesDesdeAuditoria')) {
  failures.push('firmaDocumentoOpciones.ts debe recuperar la respuesta desde firma_auditorias.');
}

if (!opcionesLib.includes("accion !== 'documento_lectura_confirmada'")) {
  failures.push('La recuperación desde auditoría debe limitarse a documento_lectura_confirmada.');
}

if (failures.length) {
  console.error(failures.map((f) => `- ${f}`).join('\n'));
  process.exit(1);
}

console.log('OK: acceptance options are verified before sealing documents.');
