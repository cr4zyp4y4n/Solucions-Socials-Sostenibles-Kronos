const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertNoDeleteBeforeWrite(relPath, fnName) {
  const source = read(relPath);
  const fnStart = source.indexOf(`export async function ${fnName}`);
  assert(fnStart >= 0, `${fnName} no encontrado en ${relPath}`);
  const nextExport = source.indexOf('\nexport ', fnStart + 1);
  const fnSource = source.slice(fnStart, nextExport >= 0 ? nextExport : source.length);

  const firstDelete = fnSource.indexOf('.delete()');
  const firstInsert = fnSource.search(/\.(insert|upsert)\(/);
  assert(firstInsert >= 0, `${fnName} debe escribir antes de borrar datos antiguos`);
  assert(
    firstDelete < 0 || firstInsert < firstDelete,
    `${fnName} vuelve a borrar datos antiguos antes de guardar el reemplazo`
  );
}

assertNoDeleteBeforeWrite(
  'src/services/pigEstimadosSubvencionService.js',
  'upsertPigEstimadosSubvencion'
);
assertNoDeleteBeforeWrite(
  'src/services/pigObjetivosComparativaService.js',
  'upsertPigObjetivosComparativa'
);
assertNoDeleteBeforeWrite(
  'src/services/pigItinerarioEiService.js',
  'upsertPigItinerarioEi'
);
assertNoDeleteBeforeWrite(
  'src/services/pigTesoreriaPrevisionesService.js',
  'upsertPigTesoreriaPrevisiones'
);

const impuestosService = read('src/services/pigTesoreriaImpuestosService.js');
assert(
  impuestosService.includes('missingRequiredFiscalAccounts'),
  'IMPUESTOS debe validar cuentas fiscales obligatorias de Holded'
);
assert(
  !/catch\s*\([^)]*\)\s*\{\s*return\s*\{\s*impuestos\s*:\s*\{[\s\S]*mod303Sum\s*:\s*0/.test(impuestosService),
  'IMPUESTOS no debe devolver una tabla fiscal con ceros cuando falla Holded'
);
assert(
  /impuestos\s*:\s*null/.test(impuestosService),
  'IMPUESTOS debe marcar los saldos como no disponibles en errores'
);

const pigPage = read('src/components/PIGPage.jsx');
assert(
  pigPage.includes("throw new Error('No se pudo guardar la configuración PIG antes de generar el Excel.')"),
  'generateExcel debe abortar si falla un autoguardado PIG'
);
assert(
  pigPage.includes('No se pudo generar la hoja TESORERÍA'),
  'generateExcel debe abortar si falla TESORERÍA/IMPUESTOS'
);

const tesoreriaService = read('src/services/pigTesoreriaService.js');
assert(
  tesoreriaService.includes('mod303Sum < 0 ? Math.abs(mod303Sum)'),
  'MOD 303 negativo debe convertirse en importe positivo en A PAGAR'
);

const excelFormulas = read('src/utils/pigExcelFormulas.js');
assert(
  excelFormulas.includes('IF(${gRef}<0,ABS(${gRef}),0)'),
  'La formula Excel de MOD 303 debe convertir el pago a positivo'
);

console.log('OK verify-pig-critical-regressions');
