import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const acceptPath = path.join(root, 'app', 'firmar', '[token]', 'accept', 'route.ts');
const opcionesPath = path.join(root, 'lib', 'firmaDocumentoOpciones.ts');

const accept = fs.readFileSync(acceptPath, 'utf8');
const opciones = fs.readFileSync(opcionesPath, 'utf8');

if (/normalizeRespuestaAceptacion\([^)]*\)\s*(\|\||\?\?)\s*['"]si['"]/.test(accept)) {
  throw new Error('/accept no debe convertir respuestas ausentes en "si".');
}

const prevalidationIndex = accept.indexOf('const declaracionesAceptadas = []');
const stampingIndex = accept.indexOf('const signedPaths: string[] = []');
if (prevalidationIndex === -1 || stampingIndex === -1 || prevalidationIndex > stampingIndex) {
  throw new Error('/accept debe validar respuestas Si/No antes de sellar PDFs.');
}

if (!accept.includes('if (!respuesta)') || !accept.includes('falta una respuesta')) {
  throw new Error('/accept debe bloquear la firma si falta una respuesta verificable.');
}

if (!accept.includes('getReadStatementNo')) {
  throw new Error('/accept debe auditar el texto correcto cuando la respuesta es No.');
}

if (!opciones.includes('loadOpcionesFromAuditoria') || !opciones.includes("documento_lectura_confirmada")) {
  throw new Error('loadDocumentoOpciones debe recuperar la decision desde auditoria.');
}

if (!opciones.includes("detalle->>accion")) {
  throw new Error('La recuperacion de auditoria debe filtrar por accion documento_lectura_confirmada.');
}

console.log('OK: /accept exige respuesta verificable y recupera auditoria.');
