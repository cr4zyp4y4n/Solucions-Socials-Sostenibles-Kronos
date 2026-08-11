const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

function extractFunction(source, name) {
  const start = source.indexOf(`export async function ${name}`);
  if (start < 0) throw new Error(`No se encuentra ${name}`);
  const braceStart = source.indexOf('{', start);
  if (braceStart < 0) throw new Error(`No se encuentra el cuerpo de ${name}`);

  let depth = 0;
  for (let i = braceStart; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    if (source[i] === '}') depth -= 1;
    if (depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`No se pudo extraer ${name}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertNoDeleteBeforeWrite(body, label) {
  const deleteIndex = body.indexOf('.delete()');
  const writeIndexes = [body.indexOf('.insert('), body.indexOf('.upsert(')]
    .filter((idx) => idx >= 0);
  assert(writeIndexes.length > 0, `${label}: no se encontro escritura`);
  const firstWrite = Math.min(...writeIndexes);
  assert(deleteIndex < 0 || deleteIndex > firstWrite, `${label}: borra antes de escribir`);
}

const objetivos = extractFunction(
  read('src/services/pigObjetivosComparativaService.js'),
  'upsertPigObjetivosComparativa'
);
assert(objetivos.includes(".upsert(payload, { onConflict: 'linea,year,variant' })"), 'objetivos: debe usar upsert por clave unica');
assert(!objetivos.includes('.delete()'), 'objetivos: no debe borrar antes/despues de guardar');

const estimados = extractFunction(
  read('src/services/pigEstimadosSubvencionService.js'),
  'upsertPigEstimadosSubvencion'
);
assert(estimados.includes(".upsert(payload, { onConflict: 'linea,year,slot,segment' })"), 'estimados: debe usar upsert por clave unica');
assertNoDeleteBeforeWrite(estimados, 'estimados');

const itinerario = extractFunction(
  read('src/services/pigItinerarioEiService.js'),
  'upsertPigItinerarioEi'
);
assertNoDeleteBeforeWrite(itinerario, 'itinerario');

const previsiones = extractFunction(
  read('src/services/pigTesoreriaPrevisionesService.js'),
  'upsertPigTesoreriaPrevisiones'
);
assertNoDeleteBeforeWrite(previsiones, 'previsiones');

const pigPage = read('src/components/PIGPage.jsx');
assert(pigPage.includes('const ensureAutosaves = async (saves) =>'), 'PIGPage: falta ensureAutosaves');
assert(!pigPage.includes('await Promise.all([saveEstimadosSubv(), saveObjetivosComparativa(), saveItinerarioEi()]);'), 'PIGPage: autoguardados PIG sin comprobar');
assert(!pigPage.includes('saveTesoreriaPrevisiones()') || pigPage.includes('previsiones de tesorería'), 'PIGPage: autoguardado tesoreria sin comprobacion');

console.log('OK: guardados PIG no borran datos antes de confirmar escrituras y generateExcel comprueba autoguardados.');
