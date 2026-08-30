const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function indexOfOrFail(source, needle, label) {
  const idx = source.indexOf(needle);
  assert(idx >= 0, `${label}: no se encontro "${needle}"`);
  return idx;
}

function assertOrder(source, before, after, label) {
  const beforeIdx = indexOfOrFail(source, before, label);
  const afterIdx = indexOfOrFail(source, after, label);
  assert(beforeIdx < afterIdx, `${label}: "${before}" debe aparecer antes de "${after}"`);
}

function functionBody(source, name) {
  const marker = `export async function ${name}`;
  const start = indexOfOrFail(source, marker, name);
  const nextExport = source.indexOf('\nexport ', start + marker.length);
  return source.slice(start, nextExport >= 0 ? nextExport : source.length);
}

const objetivos = functionBody(
  read('src/services/pigObjetivosComparativaService.js'),
  'upsertPigObjetivosComparativa'
);
assert(
  objetivos.includes(".upsert(payload, { onConflict: 'linea,year,variant' })"),
  'objetivos debe usar upsert por clave unica'
);
assert(!objetivos.includes('.delete()'), 'objetivos no debe borrar antes de escribir');

const estimados = functionBody(
  read('src/services/pigEstimadosSubvencionService.js'),
  'upsertPigEstimadosSubvencion'
);
assert(
  estimados.includes(".upsert(payload, { onConflict: 'linea,year,slot,segment' })"),
  'estimados debe usar upsert por clave unica'
);
assertOrder(estimados, '.upsert(payload', "select('id, linea, slot, segment')", 'estimados');
assertOrder(estimados, "select('id, linea, slot, segment')", ".in('id', staleIds)", 'estimados');

for (const [rel, fn] of [
  ['src/services/pigItinerarioEiService.js', 'upsertPigItinerarioEi'],
  ['src/services/pigTesoreriaPrevisionesService.js', 'upsertPigTesoreriaPrevisiones']
]) {
  const body = functionBody(read(rel), fn);
  assertOrder(body, ".select('id')", '.insert(payload)', fn);
  assertOrder(body, '.insert(payload)', ".in('id', oldIds)", fn);
  assert(
    body.includes('insertedIds') && body.includes(".in('id', insertedIds)"),
    `${fn}: debe intentar rollback de filas nuevas si falla el borrado de antiguas`
  );
}

const impuestos = read('src/services/pigTesoreriaImpuestosService.js');
assert(
  impuestos.includes("impuestos: null"),
  'fallos de impuestos deben devolver null, no ceros silenciosos'
);
assert(
  impuestos.includes('Holded no devolvió cuentas fiscales') || impuestos.includes('Holded no devolvio cuentas fiscales'),
  'impuestos debe validar presencia de cuentas fiscales'
);
assert(
  impuestos.includes('sin saldos verificables'),
  'impuestos debe validar saldos explicitos'
);

const tesoreria = read('src/services/pigTesoreriaService.js');
assert(
  tesoreria.includes('const aPagar303 = mod303Sum < 0 ? Math.abs(mod303Sum) :'),
  'MOD 303 a pagar debe ser positivo'
);

const pigPage = read('src/components/PIGPage.jsx');
assert(
  pigPage.includes('const ensureAllSaved = async (tasks) =>'),
  'generateExcel debe validar resultados de autoguardados'
);
assert(
  pigPage.includes('export cancelado para no generar un Excel con datos obsoletos'),
  'generateExcel debe abortar si falla un autoguardado'
);
assert(
  pigPage.includes('No se pudieron cargar los impuestos de Holded'),
  'generateExcel debe abortar si no carga impuestos'
);
assert(
  pigPage.includes('throw e;'),
  'errores de TESORERIA deben propagarse al catch superior'
);

console.log('OK verify-pig-critical-regressions');
