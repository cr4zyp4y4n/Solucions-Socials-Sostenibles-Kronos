const fs = require('fs');
const path = require('path');

function read(rel) {
  return fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertNoYearReplace(rel) {
  const src = read(rel);
  const destructiveYearDelete = /from\(['"]pig_[^'"]+['"]\)[\s\S]{0,260}\.delete\(\)[\s\S]{0,260}\.eq\(['"]year['"],\s*y\)/;
  assert(!destructiveYearDelete.test(src), `${rel}: no debe borrar un año entero antes de guardar`);
}

const expectedUpserts = [
  ['src/services/pigObjetivosComparativaService.js', "onConflict: 'linea,year,variant'"],
  ['src/services/pigEstimadosSubvencionService.js', "onConflict: 'linea,year,slot,segment'"],
  ['src/services/pigItinerarioEiService.js', "onConflict: 'year,semestre,sort_order'"],
  ['src/services/pigTesoreriaPrevisionesService.js', "onConflict: 'year,bloque,sort_order'"]
];

for (const [rel, marker] of expectedUpserts) {
  const src = read(rel);
  assert(src.includes('.upsert('), `${rel}: falta upsert seguro`);
  assert(src.includes(marker), `${rel}: falta ${marker}`);
  assertNoYearReplace(rel);
}

const pigPage = read('src/components/PIGPage.jsx');
assert(
  pigPage.includes('saveResults.some((ok) => !ok)'),
  'PIGPage: generateExcel debe abortar si falla algun autoguardado'
);
assert(
  pigPage.includes('No se pudieron cargar los datos auxiliares PIG del año del archivo'),
  'PIGPage: generateExcel debe abortar si falla la carga de datos auxiliares de otro año'
);
assert(
  pigPage.includes('No se pudieron cargar impuestos de Holded') && pigPage.includes('throw e;'),
  'PIGPage: la hoja TESORERIA debe abortar el Excel si fallan los impuestos'
);

const impuestosService = read('src/services/pigTesoreriaImpuestosService.js');
assert(
  impuestosService.includes('hasHoldedAccountBalanceField') && impuestosService.includes('Holded no devolvió saldos fiscales completos'),
  'Impuestos: no debe convertir cuentas fiscales ausentes o sin saldo en cero silencioso'
);
assert(
  impuestosService.includes('impuestos: null'),
  'Impuestos: en error debe devolver impuestos null, no una tabla de ceros'
);

const sqlConstraints = read('database/alter_pig_safe_upsert_constraints.sql');
assert(
  sqlConstraints.includes('pig_itinerario_ei_unique unique (year, semestre, sort_order)'),
  'SQL: falta constraint unica para itinerario'
);
assert(
  sqlConstraints.includes('pig_tesoreria_previsiones_unique unique (year, bloque, sort_order)'),
  'SQL: falta constraint unica para previsiones'
);

console.log('OK verify-pig-safe-saves');
