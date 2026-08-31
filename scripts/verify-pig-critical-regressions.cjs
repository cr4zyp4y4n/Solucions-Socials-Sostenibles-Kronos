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

function indexOfOrFail(source, needle, label) {
  const idx = source.indexOf(needle);
  assert(idx >= 0, `No se encontró ${label || needle}`);
  return idx;
}

function assertNoDeleteBeforeWrite(rel, writeNeedle) {
  const source = read(rel);
  const writeIdx = indexOfOrFail(source, writeNeedle, `${rel} escritura segura`);
  const beforeWrite = source.slice(0, writeIdx);
  assert(
    !/\.delete\(\)[\s\S]*?\.eq\('year',\s*y\)/.test(beforeWrite),
    `${rel} vuelve a borrar el año antes de escribir el reemplazo`
  );
}

assertNoDeleteBeforeWrite(
  'src/services/pigEstimadosSubvencionService.js',
  ".upsert(payload, { onConflict: 'linea,year,slot,segment' })"
);
assertNoDeleteBeforeWrite(
  'src/services/pigObjetivosComparativaService.js',
  ".upsert(payload, { onConflict: 'linea,year,variant' })"
);
assertNoDeleteBeforeWrite(
  'src/services/pigItinerarioEiService.js',
  '.insert(payload)'
);
assertNoDeleteBeforeWrite(
  'src/services/pigTesoreriaPrevisionesService.js',
  '.insert(payload)'
);

const impuestosService = read('src/services/pigTesoreriaImpuestosService.js');
assert(
  impuestosService.includes('assertFiscalBalancesAvailable(raw || [])'),
  'IMPUESTOS debe validar que Holded entregue saldos fiscales verificables'
);
assert(
  /catch \(error\) \{\s*return \{\s*impuestos: null,\s*error\s*\}/.test(impuestosService),
  'IMPUESTOS no debe devolver una tabla de ceros cuando Holded falla'
);

const tesoreriaService = read('src/services/pigTesoreriaService.js');
assert(
  tesoreriaService.includes('const aPagar303 = mod303Sum < 0 ? Math.abs(mod303Sum) :'),
  'MOD 303 negativo debe convertirse a importe positivo en A PAGAR'
);

const formulas = read('src/utils/pigExcelFormulas.js');
assert(
  formulas.includes('IF(${gRef}<0,ABS(${gRef}),0)'),
  'La fórmula de MOD 303 debe usar ABS en A PAGAR'
);

const pigPage = read('src/components/PIGPage.jsx');
assert(
  pigPage.includes('requireSuccessfulSaves(saveResults'),
  'generateExcel debe abortar si falla algún autoguardado'
);
assert(
  pigPage.includes('No se pudo generar el Excel porque IMPUESTOS no se cargó desde Holded'),
  'generateExcel debe abortar si falla la carga de IMPUESTOS'
);
assert(
  /catch \(e\) \{\s*console\.error\('Error generando hoja TESORERÍA:', e\);\s*throw e;\s*\}/.test(pigPage),
  'La hoja TESORERÍA no debe ocultar errores críticos y continuar la descarga'
);

console.log('OK verify-pig-critical-regressions');
