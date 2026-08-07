const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function getFunctionBody(relPath, functionName) {
  const source = read(relPath);
  const start = source.indexOf(`export async function ${functionName}`);
  assert(start >= 0, `${functionName} no encontrado en ${relPath}`);
  const nextExport = source.indexOf('\nexport ', start + 1);
  return source.slice(start, nextExport >= 0 ? nextExport : source.length);
}

function assertNoDeleteByYear(relPath, functionName) {
  const body = getFunctionBody(relPath, functionName);
  assert(
    !/\.delete\(\)[\s\S]{0,200}\.eq\('year'/.test(body),
    `${functionName} borra por year; debe limpiar por IDs antiguos después de guardar`
  );
}

const objetivos = getFunctionBody('src/services/pigObjetivosComparativaService.js', 'upsertPigObjetivosComparativa');
assert(
  objetivos.includes(".upsert(payload, { onConflict: 'linea,year,variant' })"),
  'Objetivos debe usar upsert por clave única, no delete + insert'
);

const estimados = getFunctionBody('src/services/pigEstimadosSubvencionService.js', 'upsertPigEstimadosSubvencion');
assert(
  estimados.includes(".upsert(payload, { onConflict: 'linea,year,slot,segment' })"),
  'Estimados debe usar upsert por clave única, no delete + insert'
);

assertNoDeleteByYear('src/services/pigEstimadosSubvencionService.js', 'upsertPigEstimadosSubvencion');
assertNoDeleteByYear('src/services/pigItinerarioEiService.js', 'upsertPigItinerarioEi');
assertNoDeleteByYear('src/services/pigTesoreriaPrevisionesService.js', 'upsertPigTesoreriaPrevisiones');

for (const [relPath, functionName] of [
  ['src/services/pigItinerarioEiService.js', 'upsertPigItinerarioEi'],
  ['src/services/pigTesoreriaPrevisionesService.js', 'upsertPigTesoreriaPrevisiones']
]) {
  const body = getFunctionBody(relPath, functionName);
  const insertPos = body.indexOf('.insert(payload)');
  const oldDeletePos = body.indexOf(".in('id', oldIds)", insertPos);
  assert(insertPos >= 0, `${functionName} debe insertar el payload nuevo`);
  assert(oldDeletePos > insertPos, `${functionName} debe borrar IDs antiguos solo después del insert`);
}

const pigPage = read('src/components/PIGPage.jsx');
assert(
  pigPage.includes('const ensureAutosaves = async (saves, label) => {'),
  'PIGPage debe definir una barrera de autoguardados antes de generar Excel'
);
assert(
  /throw new Error\(`\$\{label\}: no se ha generado el Excel/.test(pigPage),
  'La barrera de autoguardados debe abortar la generación Excel si un guardado falla'
);

console.log('OK verify-pig-safe-saves');
