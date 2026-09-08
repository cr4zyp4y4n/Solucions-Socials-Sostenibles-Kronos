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

const serviceFiles = [
  'src/services/pigObjetivosComparativaService.js',
  'src/services/pigEstimadosSubvencionService.js',
  'src/services/pigItinerarioEiService.js',
  'src/services/pigTesoreriaPrevisionesService.js',
  'src/services/pigTesoreriaCajaCortoService.js'
];

for (const rel of serviceFiles) {
  const src = read(rel);
  assert(
    !/\.delete\(\)\s*\n\s*\.eq\('year', y\);\s*\n\s*if \(deleteError\) return \{ error: deleteError \};\s*\n\s*if \(!payload\.length\) return \{ error: null \};/.test(src),
    `${rel}: no debe borrar el año antes de insertar un payload no vacío`
  );
}

const objetivos = read('src/services/pigObjetivosComparativaService.js');
assert(
  objetivos.includes(".upsert(payload, { onConflict: 'linea,year,variant' })"),
  'Objetivos PIG debe usar upsert por clave única'
);

const estimados = read('src/services/pigEstimadosSubvencionService.js');
assert(
  estimados.includes(".upsert(payload, { onConflict: 'linea,year,slot,segment' })"),
  'Estimados PIG debe usar upsert por clave única'
);
assert(
  estimados.includes('const keepKeys = new Set') && estimados.includes('staleIds'),
  'Estimados PIG debe limpiar tramos obsoletos solo después del upsert'
);

for (const rel of [
  'src/services/pigItinerarioEiService.js',
  'src/services/pigTesoreriaPrevisionesService.js',
  'src/services/pigTesoreriaCajaCortoService.js'
]) {
  const src = read(rel);
  assert(
    src.includes('.insert(payload)\n    .select(\'id\')') && src.includes(".not('id', 'in'"),
    `${rel}: debe insertar replacements y borrar solo IDs antiguos después`
  );
}

const impuestos = read('src/services/pigTesoreriaImpuestosService.js');
assert(
  impuestos.includes('Holded no devolvió saldos fiscales verificables para IMPUESTOS'),
  'IMPUESTOS no debe fabricar ceros cuando Holded no devuelve saldos fiscales verificables'
);
assert(
  !/catch \(error\) \{\s*return \{\s*impuestos: \{[\s\S]*balance: 0/.test(impuestos),
  'IMPUESTOS no debe devolver balances a cero en catch'
);

const pigPage = read('src/components/PIGPage.jsx');
assert(
  pigPage.includes('saveResults.some((ok) => ok !== true)'),
  'generateExcel debe abortar si falla un autoguardado auxiliar'
);
assert(
  pigPage.includes('impuestosError || !impuestos'),
  'generateExcel debe abortar si IMPUESTOS no está disponible'
);
assert(
  pigPage.includes('estimadosLoading || objetivosLoading || itinerarioLoading || previsionesLoading || cajaCortoLoading'),
  'generateExcel debe esperar a que terminen de cargar datos auxiliares'
);

console.log('OK: regresiones críticas PIG cubiertas.');
