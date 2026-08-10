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

function assertNoYearWideDelete(rel) {
  const source = read(rel);
  assert(!/\.delete\(\)\s*\.eq\('year',\s*y\)/.test(source), `${rel}: contiene delete(year) amplio`);
}

assert(read('src/services/pigEstimadosSubvencionService.js').includes(".upsert(payload, { onConflict: 'linea,year,slot,segment' })"), 'estimados debe usar upsert por clave unica');
assert(read('src/services/pigObjetivosComparativaService.js').includes(".upsert(payload, { onConflict: 'linea,year,variant' })"), 'objetivos debe usar upsert por clave unica');

assertNoYearWideDelete('src/services/pigEstimadosSubvencionService.js');
assertNoYearWideDelete('src/services/pigObjetivosComparativaService.js');
assertNoYearWideDelete('src/services/pigItinerarioEiService.js');
assertNoYearWideDelete('src/services/pigTesoreriaPrevisionesService.js');

const page = read('src/components/PIGPage.jsx');
assert(page.includes('requireSuccessfulSaves(saveResults'), 'generateExcel debe comprobar resultados de autoguardado');
assert(page.includes('Excel cancelado'), 'generateExcel debe cancelar si falla un autoguardado');
assert(page.includes('No se pudieron cargar los datos auxiliares'), 'generateExcel debe abortar si fallan cargas auxiliares de otro ano');

console.log('OK PIG safe saves: no delete-before-write y Excel aborta ante fallos');
