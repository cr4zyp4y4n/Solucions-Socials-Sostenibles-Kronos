const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function functionBody(source, name) {
  const marker = `export async function ${name}`;
  const start = source.indexOf(marker);
  assert(start >= 0, `No se encontró ${name}`);
  const signatureEnd = source.indexOf(') {', start);
  assert(signatureEnd >= 0, `No se encontró el cuerpo de ${name}`);
  const brace = signatureEnd + 2;
  let depth = 0;
  for (let i = brace; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    if (source[i] === '}') depth -= 1;
    if (depth === 0) return source.slice(brace, i + 1);
  }
  throw new Error(`No se pudo extraer ${name}`);
}

function assertNoDeleteBeforeWrite(rel, fnName, writeToken) {
  const body = functionBody(read(rel), fnName);
  const deleteIdx = body.indexOf('.delete()');
  const writeIdx = body.indexOf(writeToken);
  assert(writeIdx >= 0, `${fnName} debe escribir con ${writeToken}`);
  const emptyPayloadGuardIdx = body.lastIndexOf('if (!payload.length)', deleteIdx);
  assert(
    deleteIdx < 0 || writeIdx < deleteIdx || emptyPayloadGuardIdx >= 0,
    `${fnName} no puede borrar filas existentes antes de confirmar el reemplazo`
  );
}

assertNoDeleteBeforeWrite(
  'src/services/pigObjetivosComparativaService.js',
  'upsertPigObjetivosComparativa',
  '.upsert('
);
assertNoDeleteBeforeWrite(
  'src/services/pigEstimadosSubvencionService.js',
  'upsertPigEstimadosSubvencion',
  '.upsert('
);
assertNoDeleteBeforeWrite(
  'src/services/pigItinerarioEiService.js',
  'upsertPigItinerarioEi',
  '.insert('
);
assertNoDeleteBeforeWrite(
  'src/services/pigTesoreriaPrevisionesService.js',
  'upsertPigTesoreriaPrevisiones',
  '.insert('
);

const page = read('src/components/PIGPage.jsx');
assert(
  page.includes('assertSaved(') && page.includes('assertLoaded('),
  'generateExcel debe abortar si fallan autoguardados o cargas auxiliares'
);
assert(
  page.includes('No se pudieron cargar los saldos fiscales de Holded'),
  'generateExcel debe abortar si no se cargan los saldos fiscales'
);

const impuestosService = read('src/services/pigTesoreriaImpuestosService.js');
assert(
  impuestosService.includes('hasExplicitHoldedAccountBalance') && impuestosService.includes('requireBalance('),
  'Los saldos fiscales no deben convertirse a cero si Holded no devuelve balances explícitos'
);

const tesoreriaService = read('src/services/pigTesoreriaService.js');
assert(
  /const\s+aPagar303\s*=\s*mod303Sum\s*<\s*0\s*\?\s*Math\.abs\(mod303Sum\)\s*:\s*''/.test(tesoreriaService),
  'MOD 303 acreedor debe aparecer positivo en A PAGAR'
);

console.log('PIG critical regression checks passed');
