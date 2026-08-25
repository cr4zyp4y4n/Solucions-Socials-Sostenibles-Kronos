const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertNotDeleteThenInsert(relativePath, functionName) {
  const source = read(relativePath);
  const start = source.indexOf(`export async function ${functionName}`);
  assert(start >= 0, `${functionName} no encontrado en ${relativePath}`);
  const nextFunction = source.indexOf('\nexport ', start + 1);
  const body = source
    .slice(start, nextFunction >= 0 ? nextFunction : source.length)
    .replace(/if \(!payload\.length\) \{[\s\S]*?return \{ error: null \};\n  \}/g, '');
  const deleteYear = body.search(/\.delete\(\)[\s\S]{0,240}\.eq\('year',\s*y\)/);
  const insert = body.search(/\.(insert|upsert)\(payload/);
  assert(
    deleteYear < 0 || insert < 0 || deleteYear > insert,
    `${functionName} borra el year antes de escribir payload`
  );
}

assertNotDeleteThenInsert(
  'src/services/pigObjetivosComparativaService.js',
  'upsertPigObjetivosComparativa'
);
assertNotDeleteThenInsert(
  'src/services/pigEstimadosSubvencionService.js',
  'upsertPigEstimadosSubvencion'
);
assertNotDeleteThenInsert(
  'src/services/pigItinerarioEiService.js',
  'upsertPigItinerarioEi'
);
assertNotDeleteThenInsert(
  'src/services/pigTesoreriaPrevisionesService.js',
  'upsertPigTesoreriaPrevisiones'
);

const pigPage = read('src/components/PIGPage.jsx');
assert(
  /estimadosLoading \|\| objetivosLoading \|\| itinerarioLoading \|\| previsionesLoading/.test(pigPage),
  'generateExcel debe bloquearse mientras cargan datos editables PIG'
);
assert(
  /saveResults\.some\(\(ok\) => !ok\)/.test(pigPage),
  'generateExcel debe abortar si falla algun autoguardado'
);
assert(
  /loadEstError \|\| loadObjError \|\| loadItError/.test(pigPage),
  'generateExcel debe abortar si falla la carga de datos PIG de otro year'
);
assert(
  /itErr \|\| prErr/.test(pigPage),
  'generateExcel debe abortar si falla la carga de datos CR de otro year'
);

console.log('OK: guardados y export PIG protegidos contra perdida critica.');
