const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function extractFunction(source, name) {
  const marker = `export async function ${name}`;
  const start = source.indexOf(marker);
  if (start === -1) throw new Error(`No se encontró ${name}`);
  const signatureEnd = source.indexOf(') {', start);
  if (signatureEnd === -1) throw new Error(`No se encontró la firma de ${name}`);
  const open = signatureEnd + 2;
  if (open === -1) throw new Error(`No se encontró el cuerpo de ${name}`);

  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    const char = source[i];
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error(`No se pudo cerrar el cuerpo de ${name}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertOrdered(body, checks, label) {
  let cursor = -1;
  for (const check of checks) {
    const index = body.indexOf(check, cursor + 1);
    assert(index !== -1, `${label}: falta "${check}"`);
    assert(index > cursor, `${label}: "${check}" no aparece en el orden esperado`);
    cursor = index;
  }
}

const objetivos = extractFunction(
  read('src/services/pigObjetivosComparativaService.js'),
  'upsertPigObjetivosComparativa'
);
assert(!objetivos.includes('.delete()'), 'Objetivos no debe borrar antes de guardar');
assert(
  objetivos.includes(".upsert(payload, { onConflict: 'linea,year,variant' })"),
  'Objetivos debe usar upsert por la clave única'
);

const estimados = extractFunction(
  read('src/services/pigEstimadosSubvencionService.js'),
  'upsertPigEstimadosSubvencion'
);
assert(!estimados.includes('.insert(payload)'), 'Estimados no debe usar insert tras borrar filas');
assertOrdered(
  estimados,
  [
    'if (!payload.length)',
    "select('id, linea, slot, segment')",
    ".upsert(payload, { onConflict: 'linea,year,slot,segment' })",
    'const payloadKeys',
    '.delete()'
  ],
  'Estimados'
);

for (const [relativePath, functionName, label] of [
  ['src/services/pigTesoreriaPrevisionesService.js', 'upsertPigTesoreriaPrevisiones', 'Tesorería previsiones'],
  ['src/services/pigItinerarioEiService.js', 'upsertPigItinerarioEi', 'Itinerario E.I.']
]) {
  const body = extractFunction(read(relativePath), functionName);
  assertOrdered(
    body,
    [
      'if (!payload.length)',
      "select('id')",
      '.insert(payload)',
      'const staleIds',
      '.delete()'
    ],
    label
  );
}

console.log('OK: los guardados PIG críticos no borran datos existentes antes de persistir los nuevos.');
