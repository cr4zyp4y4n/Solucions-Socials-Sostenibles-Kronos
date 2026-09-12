const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`OK: ${message}`);
  }
}

function indexOfRequired(source, needle, label) {
  const idx = source.indexOf(needle);
  assert(idx !== -1, `${label} contiene ${needle}`);
  return idx;
}

const objetivos = read('src/services/pigObjetivosComparativaService.js');
assert(
  !/from\('pig_objetivos_comparativa'\)[\s\S]{0,200}\.delete\(\)/.test(objetivos),
  'objetivos no borra el año antes de escribir'
);
assert(
  objetivos.includes(".upsert(payload, { onConflict: 'linea,year,variant' })"),
  'objetivos usa upsert por clave única'
);

const estimados = read('src/services/pigEstimadosSubvencionService.js');
const estimadosUpsert = indexOfRequired(
  estimados,
  ".upsert(payload, { onConflict: 'linea,year,slot,segment' })",
  'estimados'
);
const estimadosDelete = indexOfRequired(estimados, ".delete()\n      .in('id', staleIds)", 'estimados');
assert(estimadosUpsert < estimadosDelete, 'estimados limpia filas obsoletas solo tras upsert correcto');

for (const relativePath of [
  'src/services/pigItinerarioEiService.js',
  'src/services/pigTesoreriaPrevisionesService.js',
  'src/services/pigTesoreriaCajaCortoService.js',
  'src/services/pigCrSubvEjerciciosAnterioresService.js'
]) {
  const source = read(relativePath);
  assert(
    source.includes('safeReplacePigRowsById'),
    `${relativePath} usa reemplazo seguro por IDs`
  );
  assert(
    !/\.delete\(\)[\s\S]{0,120}\.eq\('year'/.test(source),
    `${relativePath} no ejecuta delete(year) directo`
  );
}

const safeReplace = read('src/services/pigSafeReplaceService.js');
const safeInsert = indexOfRequired(safeReplace, '.insert(rows)', 'safeReplace');
const safeDelete = indexOfRequired(safeReplace, ".delete().in('id', oldIds)", 'safeReplace');
assert(safeInsert < safeDelete, 'safeReplace inserta filas nuevas antes de borrar las antiguas');

const pigPage = read('src/components/PIGPage.jsx');
assert(pigPage.includes('requireSuccessfulSaves'), 'generateExcel comprueba autoguardados críticos');
assert(
  pigPage.includes('No se pudieron guardar los datos auxiliares del PIG') &&
    pigPage.includes('No se pudieron guardar todos los datos de Cuenta Resultados'),
  'generateExcel aborta si falla algún autoguardado'
);
assert(
  pigPage.includes('cajaCortoSaveError') &&
    pigPage.includes('No se pudo guardar la previsión de caja a corto'),
  'generateExcel aborta si falla el guardado automático de caja a corto'
);
assert(
  pigPage.includes('No se pudieron cargar todos los datos auxiliares del año del PIG') &&
    pigPage.includes('No se pudieron cargar todos los datos de Cuenta Resultados del año del PIG'),
  'generateExcel aborta si fallan cargas auxiliares de otro año'
);

if (process.exitCode) {
  process.exit(process.exitCode);
}

