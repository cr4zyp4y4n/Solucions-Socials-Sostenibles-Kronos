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

function assertOrder(source, first, second, message) {
  const firstIdx = source.indexOf(first);
  const secondIdx = source.indexOf(second);
  assert(firstIdx >= 0, `No se encontró: ${first}`);
  assert(secondIdx >= 0, `No se encontró: ${second}`);
  assert(firstIdx < secondIdx, message);
}

const estimados = read('src/services/pigEstimadosSubvencionService.js');
assert(
  estimados.includes(".upsert(payload, { onConflict: 'linea,year,slot,segment' })"),
  'Estimados debe usar upsert por clave única antes de limpiar obsoletos.'
);
assertOrder(
  estimados,
  '.upsert(payload',
  ".not('id', 'in'",
  'Estimados no debe borrar filas antiguas antes de guardar correctamente.'
);

const objetivos = read('src/services/pigObjetivosComparativaService.js');
assert(
  objetivos.includes(".upsert(payload, { onConflict: 'linea,year,variant' })"),
  'Objetivos debe usar upsert por clave única, no delete -> insert.'
);
assert(
  !/\.delete\(\)[\s\S]*?\.eq\('year', y\)[\s\S]*?\.insert\(payload\)/.test(objetivos),
  'Objetivos no debe reintroducir delete(year) -> insert(payload).'
);

for (const relPath of [
  'src/services/pigItinerarioEiService.js',
  'src/services/pigTesoreriaPrevisionesService.js'
]) {
  const source = read(relPath);
  assertOrder(
    source,
    '.insert(payload)',
    ".not('id', 'in'",
    `${relPath} debe insertar correctamente antes de borrar filas antiguas.`
  );
  assert(
    !/const \{ error: deleteError \} = await supabase[\s\S]*?\.eq\('year', y\);\s*if \(deleteError\)[\s\S]*?\.insert\(payload\)/.test(source),
    `${relPath} no debe reintroducir delete(year) -> insert(payload).`
  );
}

const impuestosService = read('src/services/pigTesoreriaImpuestosService.js');
assert(
  /catch \(error\) \{\s*return \{\s*impuestos: null,\s*error\s*\};\s*\}/.test(impuestosService),
  'Errores Holded en impuestos deben devolver impuestos null, no saldos a cero.'
);

const tesoreriaService = read('src/services/pigTesoreriaService.js');
assert(
  tesoreriaService.includes('No se pudieron cargar saldos fiscales desde Holded'),
  'La hoja TESORERÍA debe marcar IMPUESTOS como no disponible cuando falla Holded.'
);

const pigPage = read('src/components/PIGPage.jsx');
assert(
  (pigPage.match(/No se ha generado el Excel porque falló un autoguardado previo\./g) || []).length >= 2,
  'generateExcel debe abortar tanto PIG como Cuenta Resultados si falla un autoguardado.'
);

console.log('OK: regresiones críticas PIG TESORERÍA cubiertas.');
