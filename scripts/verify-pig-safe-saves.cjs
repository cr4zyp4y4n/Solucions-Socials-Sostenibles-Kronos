const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function functionBody(source, functionName) {
  const marker = `export async function ${functionName}`;
  const start = source.indexOf(marker);
  if (start === -1) throw new Error(`No se encuentra ${functionName}`);
  const paramsStart = source.indexOf('(', start);
  if (paramsStart === -1) throw new Error(`No se encuentran parametros de ${functionName}`);
  let paramsDepth = 0;
  let paramsEnd = -1;
  for (let i = paramsStart; i < source.length; i += 1) {
    if (source[i] === '(') paramsDepth += 1;
    if (source[i] === ')') {
      paramsDepth -= 1;
      if (paramsDepth === 0) {
        paramsEnd = i;
        break;
      }
    }
  }
  if (paramsEnd === -1) throw new Error(`No se pudo cerrar parametros de ${functionName}`);
  const braceStart = source.indexOf('{', paramsEnd);
  let depth = 0;
  for (let i = braceStart; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(braceStart, i + 1);
    }
  }
  throw new Error(`No se pudo extraer ${functionName}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertOrder(body, labels) {
  let previous = -1;
  for (const [label, needle] of labels) {
    const index = body.indexOf(needle);
    assert(index !== -1, `Falta ${label}`);
    assert(index > previous, `${label} aparece fuera de orden seguro`);
    previous = index;
  }
}

const tesoreria = functionBody(
  read('src/services/pigTesoreriaPrevisionesService.js'),
  'upsertPigTesoreriaPrevisiones'
);
assertOrder(tesoreria, [
  ['rama de borrado vacio', 'if (!payload.length)'],
  ['lectura de ids existentes', 'const { data: existingRows'],
  ['insert nuevo payload', '.insert(payload)'],
  ['ids antiguos', 'const oldIds'],
  ['borrado por ids antiguos', ".in('id', oldIds)"]
]);

const itinerario = functionBody(
  read('src/services/pigItinerarioEiService.js'),
  'upsertPigItinerarioEi'
);
assertOrder(itinerario, [
  ['rama de borrado vacio', 'if (!payload.length)'],
  ['lectura de ids existentes', 'const { data: existingRows'],
  ['insert nuevo payload', '.insert(payload)'],
  ['ids antiguos', 'const oldIds'],
  ['borrado por ids antiguos', ".in('id', oldIds)"]
]);

const objetivos = functionBody(
  read('src/services/pigObjetivosComparativaService.js'),
  'upsertPigObjetivosComparativa'
);
assert(!objetivos.includes('.delete()'), 'Objetivos no debe borrar antes de guardar');
assert(
  objetivos.includes(".upsert(payload, { onConflict: 'linea,year,variant' })"),
  'Objetivos debe usar upsert por clave unica'
);

const estimados = functionBody(
  read('src/services/pigEstimadosSubvencionService.js'),
  'upsertPigEstimadosSubvencion'
);
assertOrder(estimados, [
  ['rama de borrado vacio', 'if (!payload.length)'],
  ['lectura de filas existentes', 'const { data: existingRows'],
  ['upsert nuevo payload', ".upsert(payload, { onConflict: 'linea,year,slot,segment' })"],
  ['calculo de obsoletos', 'const obsoleteIds'],
  ['borrado de obsoletos', ".in('id', obsoleteIds)"]
]);

const pigPage = read('src/components/PIGPage.jsx');
const generateExcel = functionBody(pigPage, 'generateExcel');
assert(
  generateExcel.includes('estimadosLoading || objetivosLoading || itinerarioLoading || previsionesLoading'),
  'generateExcel debe bloquearse mientras cargan datos auxiliares'
);
assert(
  generateExcel.includes('Number(yearForEstimados) !== Number(estimadosYear)')
    && generateExcel.includes('El archivo mensual parece ser de'),
  'generateExcel debe abortar si el año del archivo no coincide con el año editable'
);
assert(
  generateExcel.includes('const [estimadosSaved, objetivosSaved]')
    && generateExcel.includes('No se generó el Excel porque falló el guardado previo de estimados u objetivos.'),
  'generateExcel debe abortar si falla el guardado previo de estimados/objetivos'
);
assert(
  generateExcel.includes('const [objetivosSaved, itinerarioSaved, previsionesSaved]')
    && generateExcel.includes('No se generó el Excel porque falló el guardado previo de objetivos, itinerario o previsiones.'),
  'generateExcel debe abortar si falla el guardado previo de Cuenta Resultados'
);

console.log('OK: guardados PIG evitan delete-before-write en payloads no vacios.');
