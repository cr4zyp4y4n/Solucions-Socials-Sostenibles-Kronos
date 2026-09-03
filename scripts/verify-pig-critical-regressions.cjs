const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertInsertBeforeDelete(relativePath, functionName) {
  const source = read(relativePath);
  const start = source.indexOf(`export async function ${functionName}`);
  assert(start >= 0, `${functionName} no encontrado en ${relativePath}`);
  const body = source.slice(start, source.indexOf('\n}', start) + 2);
  const insertAt = body.indexOf('.insert(payload)');
  const deleteAt = body.indexOf('.delete()');
  assert(insertAt >= 0, `${functionName} debe insertar el reemplazo antes de limpiar filas antiguas`);
  assert(deleteAt >= 0, `${functionName} debe limpiar filas antiguas tras insertar`);
  assert(insertAt < deleteAt, `${functionName} vuelve a borrar antes de insertar y puede perder datos`);
}

function assertNoDeleteBeforeUpsert(relativePath, functionName) {
  const source = read(relativePath);
  const start = source.indexOf(`export async function ${functionName}`);
  assert(start >= 0, `${functionName} no encontrado en ${relativePath}`);
  const body = source.slice(start, source.indexOf('\n}', start) + 2);
  const upsertAt = body.indexOf('.upsert(');
  const deleteAt = body.indexOf('.delete()');
  assert(upsertAt >= 0, `${functionName} debe usar upsert seguro`);
  assert(deleteAt < 0 || upsertAt < deleteAt, `${functionName} no debe borrar antes de escribir`);
}

assertNoDeleteBeforeUpsert(
  'src/services/pigObjetivosComparativaService.js',
  'upsertPigObjetivosComparativa'
);
assertNoDeleteBeforeUpsert(
  'src/services/pigEstimadosSubvencionService.js',
  'upsertPigEstimadosSubvencion'
);
assertInsertBeforeDelete(
  'src/services/pigItinerarioEiService.js',
  'upsertPigItinerarioEi'
);
assertInsertBeforeDelete(
  'src/services/pigTesoreriaPrevisionesService.js',
  'upsertPigTesoreriaPrevisiones'
);
assertNoDeleteBeforeUpsert(
  'src/services/obradorSupabaseService.js',
  'setProducteProveidors'
);

const pigPage = read('src/components/PIGPage.jsx');
assert(
  pigPage.includes('ensureSavesSucceeded') && pigPage.includes('results.some((ok) => ok !== true)'),
  'generateExcel debe abortar si falla algun autoguardado'
);
assert(
  pigPage.includes('ensureAuxDataReady') && pigPage.includes('estimadosLoading || objetivosLoading || itinerarioLoading || previsionesLoading'),
  'generateExcel debe esperar a que terminen de cargar los datos auxiliares'
);
assert(
  pigPage.includes('impuestosError || !impuestos') && pigPage.includes("throw e;"),
  'La hoja TESORERÍA debe abortar si no hay impuestos verificables'
);

const impuestosService = read('src/services/pigTesoreriaImpuestosService.js');
assert(
  impuestosService.includes('hasAnyFiscalBalance') && impuestosService.includes('impuestos: null'),
  'IMPUESTOS no debe fabricar ceros ante fallos o ausencia de saldos fiscales'
);

console.log('OK: regresiones criticas PIG/Obrador cubiertas');
