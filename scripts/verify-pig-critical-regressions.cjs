const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const objetivos = read('src/services/pigObjetivosComparativaService.js');
assert(
  objetivos.includes(".upsert(payload, { onConflict: 'linea,year,variant' })"),
  'Objetivos PIG debe usar upsert por clave unica'
);
assert(!objetivos.includes('.delete()'), 'Objetivos PIG no debe borrar antes de guardar');

const estimados = read('src/services/pigEstimadosSubvencionService.js');
assert(
  estimados.includes(".upsert(payload, { onConflict: 'linea,year,slot,segment' })"),
  'Estimados PIG debe usar upsert por clave unica'
);
assert(
  estimados.indexOf(".upsert(payload, { onConflict: 'linea,year,slot,segment' })") < estimados.lastIndexOf('.delete()'),
  'Estimados PIG debe limpiar obsoletos despues del upsert'
);

for (const rel of [
  'src/services/pigItinerarioEiService.js',
  'src/services/pigTesoreriaPrevisionesService.js'
]) {
  const src = read(rel);
  const emptyGuard = src.indexOf('if (!payload.length)');
  const firstDelete = src.indexOf('.delete()');
  const insert = src.indexOf('.insert(payload)');
  const lastDelete = src.lastIndexOf('.delete()');
  assert(emptyGuard >= 0 && emptyGuard < firstDelete, `${rel}: el borrado completo solo debe estar en payload vacio`);
  assert(insert >= 0 && insert < lastDelete, `${rel}: debe insertar el reemplazo antes de borrar filas antiguas`);
  assert(src.includes(".select('id')"), `${rel}: debe recuperar ids insertados antes de limpiar obsoletos`);
}

const pigPage = read('src/components/PIGPage.jsx');
assert(
  pigPage.includes('abortOnAutosaveFailure(await Promise.all'),
  'generateExcel debe abortar si falla algun autoguardado'
);
assert(
  /if \(impuestosError\) \{[\s\S]*?throw new Error\([\s\S]*?saldos fiscales/.test(pigPage),
  'generateExcel debe abortar si fallan los saldos fiscales de IMPUESTOS'
);
assert(
  !/await Promise\.all\(\[\s*save(?:EstimadosSubv|ObjetivosComparativa|ItinerarioEi|TesoreriaPrevisiones)[\s\S]{0,180}\]\);/.test(pigPage),
  'generateExcel no debe ignorar resultados de save*'
);

const impuestos = read('src/services/pigTesoreriaImpuestosService.js');
assert(
  impuestos.includes('if (!matchedRequiredCodes.length)') && impuestos.includes('throw new Error'),
  'loadPigImpuestosBalances debe fallar si Holded no trae cuentas fiscales'
);
assert(
  /catch \(error\) \{[\s\S]*?impuestos: null/.test(impuestos),
  'loadPigImpuestosBalances no debe devolver impuestos a cero tras error'
);

const tesoreria = read('src/services/pigTesoreriaService.js');
assert(
  tesoreria.includes('const aPagar303 = mod303Sum < 0 ? Math.abs(mod303Sum) : \'\';'),
  'MOD 303 negativo debe convertirse a importe positivo en A PAGAR'
);

console.log('OK verify-pig-critical-regressions');
