import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const acceptRoute = fs.readFileSync(
  path.join(root, 'app/firmar/[token]/accept/route.ts'),
  'utf8'
);
const opcionesLib = fs.readFileSync(path.join(root, 'lib/firmaDocumentoOpciones.ts'), 'utf8');

const checks = [
  {
    ok: !acceptRoute.includes("normalizeRespuestaAceptacion(opciones) || 'si'"),
    message: 'accept route must not default missing acceptance options to "si"'
  },
  {
    ok: acceptRoute.includes('Falta respuesta Sí/No verificable'),
    message: 'accept route must block signing when no verifiable yes/no answer exists'
  },
  {
    ok: acceptRoute.includes('getReadStatementNo'),
    message: 'accept route must audit the explicit "No" declaration text'
  },
  {
    ok:
      opcionesLib.includes('loadOpcionesFromAudit') &&
      opcionesLib.includes("detalle?.accion !== 'documento_lectura_confirmada'"),
    message: 'loadDocumentoOpciones must recover the stored answer from lectura audit'
  }
];

const failed = checks.filter((check) => !check.ok);
if (failed.length) {
  for (const check of failed) {
    console.error(`FAIL: ${check.message}`);
  }
  process.exit(1);
}

console.log('OK: firma acceptance options are verified before sealing');
