const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function indexOfOrFail(source, needle, label = needle) {
  const idx = source.indexOf(needle);
  assert(idx >= 0, `No se encontró: ${label}`);
  return idx;
}

function assertBefore(source, first, second, label) {
  const a = indexOfOrFail(source, first, `${label}: ${first}`);
  const b = indexOfOrFail(source, second, `${label}: ${second}`);
  assert(a < b, `${label}: orden inseguro (${first} debe aparecer antes que ${second})`);
}

function assertNotContains(source, needle, label) {
  assert(!source.includes(needle), `${label}: contiene patrón prohibido ${needle}`);
}

const objetivos = read('src/services/pigObjetivosComparativaService.js');
assert(objetivos.includes(".upsert(payload, { onConflict: 'linea,year,variant' })"), 'Objetivos debe usar upsert por clave única');
assertNotContains(objetivos, ".delete()\n    .eq('year', y)", 'Objetivos no debe borrar el año antes de escribir');

const estimados = read('src/services/pigEstimadosSubvencionService.js');
assert(estimados.includes(".upsert(payload, { onConflict: 'linea,year,slot,segment' })"), 'Estimados debe usar upsert por clave única');
assertBefore(estimados, ".upsert(payload, { onConflict: 'linea,year,slot,segment' })", 'const payloadKeys = new Set', 'Estimados limpia obsoletos después de escribir');

const itinerario = read('src/services/pigItinerarioEiService.js');
assertBefore(itinerario, '.insert(payload)', "const oldIds = (existingRows || []).map((row) => row.id).filter(Boolean);", 'Itinerario inserta antes de borrar IDs antiguos');

const previsiones = read('src/services/pigTesoreriaPrevisionesService.js');
assertBefore(previsiones, '.insert(payload)', "const oldIds = (existingRows || []).map((row) => row.id).filter(Boolean);", 'Previsiones inserta antes de borrar IDs antiguos');

const impuestos = read('src/services/pigTesoreriaImpuestosService.js');
assert(impuestos.includes('throw new Error(\'Holded no devolvió el plan contable para calcular IMPUESTOS.\')'), 'IMPUESTOS debe fallar si Holded no devuelve plan contable');
assert(impuestos.includes('Holded devolvió cuentas fiscales sin saldos verificables'), 'IMPUESTOS debe exigir saldos fiscales verificables');
assert(impuestos.includes('impuestos: null'), 'IMPUESTOS no debe devolver ceros en catch');
assert(impuestos.includes("raw.lastIndexOf('.') > raw.lastIndexOf(',')"), 'IMPUESTOS debe distinguir decimales US/ES al parsear saldos');
assertNotContains(impuestos, 'mod303: IMPUESTOS_MOD_303_ACCOUNTS.map((r) => ({ ...r, balance: 0 }))', 'IMPUESTOS catch no debe fabricar saldos a cero');

const tesoreria = read('src/services/pigTesoreriaService.js');
assert(tesoreria.includes('const aPagar303 = mod303Sum < 0 ? Math.abs(mod303Sum) : \'\';'), 'MOD 303 A PAGAR debe ser positivo');

const formulas = read('src/utils/pigExcelFormulas.js');
assert(formulas.includes('`IF(${gRef}<0,ABS(${gRef}),0)`'), 'Formula MOD 303 debe usar ABS en A PAGAR');
assert(formulas.includes('Math.abs(cachedAPagar303)'), 'Cache MOD 303 no debe conservar importes negativos en A PAGAR');

const pigPage = read('src/components/PIGPage.jsx');
assert(pigPage.includes('Espera a que terminen de cargar los datos auxiliares'), 'Export debe bloquear datos auxiliares cargando');
assert(pigPage.includes('saveResults.some((ok) => ok !== true)'), 'Export debe abortar si falla un autoguardado');
assert(pigPage.includes('No se pudieron cargar IMPUESTOS desde Holded'), 'Export debe abortar si falla IMPUESTOS');
assert(pigPage.includes("console.error('Error generando hoja TESORERÍA:', e);\n          throw e;"), 'TESORERÍA no debe tragarse errores críticos');

console.log('OK verify-pig-critical-regressions');
