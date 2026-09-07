const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertNoDeleteYearBeforeInsert(rel, fnName) {
  const src = read(rel);
  const fnStart = src.indexOf(`export async function ${fnName}`);
  assert(fnStart >= 0, `${fnName} no encontrado en ${rel}`);
  const fnEnd = src.indexOf('\n}\n', fnStart);
  const body = src.slice(fnStart, fnEnd >= 0 ? fnEnd : undefined);
  const firstInsert = body.search(/\.(insert|upsert)\s*\(/);
  const firstDeleteYear = body.search(/\.delete\s*\(\)[\s\S]{0,120}\.eq\('year', y\)/);
  assert(firstInsert >= 0, `${fnName} no escribe payload`);
  assert(
    firstDeleteYear < 0 || firstDeleteYear > firstInsert || /if \(!payload\.length\)/.test(body),
    `${fnName} puede borrar el año antes de escribir datos nuevos`
  );
}

assertNoDeleteYearBeforeInsert('src/services/pigTesoreriaCajaCortoService.js', 'upsertPigTesoreriaCajaCorto');
assertNoDeleteYearBeforeInsert('src/services/pigItinerarioEiService.js', 'upsertPigItinerarioEi');
assertNoDeleteYearBeforeInsert('src/services/pigTesoreriaPrevisionesService.js', 'upsertPigTesoreriaPrevisiones');

const objetivos = read('src/services/pigObjetivosComparativaService.js');
assert(
  /upsert\(payload,\s*\{\s*onConflict:\s*'linea,year,variant'\s*\}\)/.test(objetivos),
  'Objetivos debe usar upsert por clave única'
);

const estimados = read('src/services/pigEstimadosSubvencionService.js');
assert(
  /upsert\(payload,\s*\{\s*onConflict:\s*'linea,year,slot,segment'\s*\}\)/.test(estimados),
  'Estimados debe usar upsert por clave única'
);
assert(/obsoleteIds/.test(estimados), 'Estimados debe limpiar tramos obsoletos después del upsert');

const impuestos = read('src/services/pigTesoreriaImpuestosService.js');
assert(/impuestos:\s*null/.test(impuestos), 'Impuestos no debe fabricar bloque cero en errores');
assert(/missingCodes/.test(impuestos), 'Impuestos debe exigir saldos fiscales verificables');

const tesoreria = read('src/services/pigTesoreriaService.js');
assert(/Math\.abs\(mod303Sum\)/.test(tesoreria), 'MOD 303 inicial debe ser importe positivo a pagar');

const formulas = read('src/utils/pigExcelFormulas.js');
assert(/IF\(\$\{gRef\}<0,ABS\(\$\{gRef\}\),0\)/.test(formulas), 'Fórmula MOD 303 debe usar ABS');

const pigPage = read('src/components/PIGPage.jsx');
assert(/saveResults\.some\(\(ok\) => ok !== true\)/.test(pigPage), 'generateExcel debe abortar si falla un autoguardado');
assert(/throw new Error\(`No se generó el Excel porque no se pudieron cargar impuestos/.test(pigPage), 'generateExcel debe abortar si fallan impuestos');
assert(/throw e;\s*\n\s*}/.test(pigPage), 'La hoja TESORERÍA debe propagar errores críticos');

console.log('OK verify-pig-critical-regressions');
