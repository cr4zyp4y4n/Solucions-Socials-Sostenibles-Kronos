const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertReplacementInsertBeforeOldDelete(relPath) {
  const src = read(relPath);
  const insertPayloadIdx = src.indexOf('.insert(payload)');
  const oldIdsIdx = src.indexOf('const oldIds =');
  assert(
    insertPayloadIdx !== -1 && oldIdsIdx !== -1 && insertPayloadIdx < oldIdsIdx,
    `${relPath}: debe insertar el reemplazo antes de borrar ids antiguos`
  );
}

assert(read('src/services/pigObjetivosComparativaService.js').includes(".upsert(payload, { onConflict: 'linea,year,variant' })"));
assert(read('src/services/pigEstimadosSubvencionService.js').includes(".upsert(payload, { onConflict: 'linea,year,slot,segment' })"));

assertReplacementInsertBeforeOldDelete('src/services/pigItinerarioEiService.js');
assertReplacementInsertBeforeOldDelete('src/services/pigTesoreriaPrevisionesService.js');

const pigPage = read('src/components/PIGPage.jsx');
assert(pigPage.includes('No se generó el Excel porque falló el autoguardado PIG.'), 'PIGPage debe abortar Excel si falla autoguardado');
assert(pigPage.includes('No se generó el Excel CR porque falló el autoguardado PIG.'), 'PIGPage debe abortar Excel CR si falla autoguardado');
assert(pigPage.includes('No se pudieron cargar los estimados'), 'PIGPage debe abortar si falla la carga de datos de otro año');

console.log('OK verify-pig-safe-saves');
