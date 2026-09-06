const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function functionBody(source, name) {
  const start = source.indexOf(`export async function ${name}`);
  assert(start >= 0, `No se encuentra ${name}`);
  const nextExport = source.indexOf('\nexport ', start + 1);
  return source.slice(start, nextExport >= 0 ? nextExport : source.length);
}

function assertNoDeleteBeforeWrite(relPath, functionName) {
  const body = functionBody(read(relPath), functionName);
  const deleteIdx = body.indexOf('.delete()');
  assert(deleteIdx >= 0, `${functionName} debe seguir limpiando filas obsoletas de forma controlada`);
  const writeOps = ['.insert(', '.upsert(']
    .map((needle) => body.indexOf(needle))
    .filter((idx) => idx >= 0);
  assert(writeOps.length > 0, `${functionName} no contiene escritura`);
  const firstWriteIdx = Math.min(...writeOps);
  assert(
    firstWriteIdx < deleteIdx || /if\s*\(!payload\.length\)[\s\S]*?\.delete\(\)/.test(body),
    `${functionName} vuelve a borrar antes de escribir datos de reemplazo`
  );
}

assertNoDeleteBeforeWrite('src/services/pigTesoreriaCajaCortoService.js', 'upsertPigTesoreriaCajaCorto');
assertNoDeleteBeforeWrite('src/services/pigTesoreriaPrevisionesService.js', 'upsertPigTesoreriaPrevisiones');
assertNoDeleteBeforeWrite('src/services/pigItinerarioEiService.js', 'upsertPigItinerarioEi');

const objetivos = functionBody(
  read('src/services/pigObjetivosComparativaService.js'),
  'upsertPigObjetivosComparativa'
);
assert(objetivos.includes('.upsert('), 'Objetivos debe usar upsert por clave unica');
assert(!objetivos.includes('.delete()'), 'Objetivos no debe borrar el ano antes de guardar');

const estimados = functionBody(
  read('src/services/pigEstimadosSubvencionService.js'),
  'upsertPigEstimadosSubvencion'
);
assert(estimados.includes('.upsert('), 'Estimados debe usar upsert por clave unica');
assert(estimados.indexOf('.upsert(') < estimados.indexOf('.delete()'), 'Estimados debe borrar obsoletos solo tras upsert');

const page = read('src/components/PIGPage.jsx');
assert(page.includes('assertNoPigPersistenceErrors(saveResults'), 'generateExcel debe abortar si falla un autosave');
assert(page.includes('assertNoPigLoadErrors(loadResults'), 'generateExcel debe abortar si falla una carga auxiliar');

const tesoreria = read('src/services/pigTesoreriaService.js');
assert(tesoreria.includes('Math.abs(mod303Sum)'), 'MOD 303 negativo debe mostrarse como importe positivo a pagar');

const formulas = read('src/utils/pigExcelFormulas.js');
assert(formulas.includes('IF(${gRef}<0,ABS(${gRef}),0)'), 'Formula MOD 303 debe usar ABS cuando el saldo es negativo');
assert(formulas.includes('Math.abs(Number(cached303))'), 'Valor cacheado MOD 303 debe ser positivo');

console.log('OK verify-pig-critical-regressions');
