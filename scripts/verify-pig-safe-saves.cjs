const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function indexOfOrFail(source, needle, label) {
  const idx = source.indexOf(needle);
  assert(idx >= 0, `${label}: no se encontró "${needle}"`);
  return idx;
}

const objetivos = read('src/services/pigObjetivosComparativaService.js');
assert(
  objetivos.includes(".upsert(payload, { onConflict: 'linea,year,variant' })"),
  'Objetivos debe usar upsert por clave única.'
);
const objetivosFn = objetivos.slice(objetivos.indexOf('export async function upsertPigObjetivosComparativa'));
assert(!objetivosFn.includes('.delete()'), 'Objetivos no debe borrar el año antes de guardar.');

const estimados = read('src/services/pigEstimadosSubvencionService.js');
assert(
  estimados.includes(".upsert(payload, { onConflict: 'linea,year,slot,segment' })"),
  'Estimados debe usar upsert por clave única.'
);
assert(
  indexOfOrFail(estimados, ".upsert(payload, { onConflict: 'linea,year,slot,segment' })", 'Estimados')
    < indexOfOrFail(estimados, 'const activeKeys = new Set', 'Estimados'),
  'Estimados debe escribir antes de calcular/borrar filas obsoletas.'
);

for (const [label, relPath] of [
  ['Itinerario', 'src/services/pigItinerarioEiService.js'],
  ['Previsiones TESORERÍA', 'src/services/pigTesoreriaPrevisionesService.js']
]) {
  const src = read(relPath);
  const selectIdx = indexOfOrFail(src, ".select('id')", label);
  const insertIdx = indexOfOrFail(src, '.insert(payload)', label);
  const deleteOldIdx = src.indexOf(".delete()\n      .in('id', oldIds)", insertIdx);
  assert(selectIdx < insertIdx, `${label} debe capturar IDs antiguos antes de insertar.`);
  assert(deleteOldIdx > insertIdx, `${label} debe borrar IDs antiguos solo después de insertar.`);
}

const pigPage = read('src/components/PIGPage.jsx');
assert(pigPage.includes('const throwLoadError = (label, error) => {'), 'PIGPage debe abortar cargas auxiliares fallidas.');
assert(pigPage.includes('const assertAutosaves = (results, label) => {'), 'PIGPage debe validar autoguardados.');
assert(
  pigPage.includes('assertAutosaves(saveResults,'),
  'generateExcel debe abortar si algún autoguardado devuelve false.'
);

console.log('OK pig safe saves');
