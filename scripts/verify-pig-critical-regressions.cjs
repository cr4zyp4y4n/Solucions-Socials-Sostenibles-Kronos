const fs = require('fs');
const path = require('path');

function read(relPath) {
  return fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function functionBody(relPath, functionName) {
  const src = read(relPath);
  const start = src.indexOf(`export async function ${functionName}`);
  assert(start >= 0, `${functionName} no encontrado en ${relPath}`);
  const nextFunction = src.indexOf('\nexport ', start + 1);
  return src.slice(start, nextFunction >= 0 ? nextFunction : src.length);
}

const objetivosSave = functionBody('src/services/pigObjetivosComparativaService.js', 'upsertPigObjetivosComparativa');
assert(objetivosSave.includes('.upsert(payload'), 'Objetivos debe usar upsert por clave única');
assert(!objetivosSave.includes('.delete()'), 'Objetivos no debe borrar el año antes de guardar');

const estimadosSave = functionBody('src/services/pigEstimadosSubvencionService.js', 'upsertPigEstimadosSubvencion');
assert(estimadosSave.includes('.upsert(payload'), 'Estimados debe usar upsert por clave única');
assert(
  estimadosSave.indexOf('.upsert(payload') < estimadosSave.indexOf('obsoleteIds.length'),
  'Estimados debe limpiar tramos obsoletos solo después del upsert'
);

for (const [relPath, functionName] of [
  ['src/services/pigItinerarioEiService.js', 'upsertPigItinerarioEi'],
  ['src/services/pigTesoreriaPrevisionesService.js', 'upsertPigTesoreriaPrevisiones'],
  ['src/services/pigTesoreriaCajaCortoService.js', 'upsertPigTesoreriaCajaCorto']
]) {
  const body = functionBody(relPath, functionName);
  assert(body.includes(".select('id')"), `${functionName} debe leer ids existentes antes de reemplazar`);
  assert(body.indexOf('.insert(payload') < body.indexOf('const existingIds'), `${functionName} debe insertar antes de limpiar ids antiguos`);
  assert(body.includes(".in('id', existingIds)"), `${functionName} debe borrar solo ids antiguos tras insertar`);
}

const pigPage = read('src/components/PIGPage.jsx');
assert(
  pigPage.includes('saveResults.some((ok) => ok !== true)'),
  'generateExcel debe abortar si falla algún autoguardado'
);
assert(
  pigPage.includes('!impuestos') && pigPage.includes('No se pudo generar el PIG: IMPUESTOS'),
  'generateExcel debe abortar si IMPUESTOS no devuelve saldos verificables'
);

const impuestos = read('src/services/pigTesoreriaImpuestosService.js');
assert(
  impuestos.includes('impuestos: null') && !impuestos.includes('mod303Sum: 0,\n        aPagar'),
  'loadPigImpuestosBalances no debe fabricar impuestos a cero en fallos de Holded'
);
assert(
  impuestos.includes('hasExplicitBalance') && impuestos.includes('sin saldos verificables'),
  'loadPigImpuestosBalances debe exigir saldos fiscales explícitos'
);

const tesoreria = read('src/services/pigTesoreriaService.js');
const formulas = read('src/utils/pigExcelFormulas.js');
assert(
  tesoreria.includes('Math.abs(mod303Sum)'),
  'MOD 303 en A PAGAR debe cachearse como importe positivo'
);
assert(
  formulas.includes('ABS(') && formulas.includes('Math.abs(Number(cached303))'),
  'La fórmula de MOD 303 debe recalcular A PAGAR como positivo'
);

console.log('OK verify-pig-critical-regressions');
