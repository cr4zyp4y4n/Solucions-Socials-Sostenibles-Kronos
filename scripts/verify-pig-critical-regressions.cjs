const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function functionBody(src, name) {
  const start = src.indexOf(`export async function ${name}`);
  assert(start >= 0, `No se encontro ${name}`);
  const signatureEnd = src.indexOf(') {', start);
  assert(signatureEnd >= 0, `No se encontro el cuerpo de ${name}`);
  const brace = signatureEnd + 2;
  let depth = 0;
  for (let i = brace; i < src.length; i += 1) {
    if (src[i] === '{') depth += 1;
    if (src[i] === '}') depth -= 1;
    if (depth === 0) return src.slice(brace, i + 1);
  }
  throw new Error(`No se pudo aislar ${name}`);
}

function assertUpsertBeforeDelete(rel, fnName, conflict) {
  const body = functionBody(read(rel), fnName);
  const upsertIdx = body.indexOf('.upsert(');
  const deleteIdx = body.indexOf('.delete()');
  assert(upsertIdx >= 0, `${fnName} debe usar upsert`);
  assert(body.includes(`onConflict: '${conflict}'`), `${fnName} debe usar onConflict ${conflict}`);
  if (deleteIdx >= 0) {
    assert(upsertIdx < deleteIdx, `${fnName} no debe borrar antes de escribir`);
  }
  assert(!/\.insert\(\s*payload\s*\)/.test(body), `${fnName} no debe reemplazar con insert(payload) tras delete`);
}

assertUpsertBeforeDelete(
  'src/services/pigObjetivosComparativaService.js',
  'upsertPigObjetivosComparativa',
  'linea,year,variant'
);
assertUpsertBeforeDelete(
  'src/services/pigEstimadosSubvencionService.js',
  'upsertPigEstimadosSubvencion',
  'linea,year,slot,segment'
);
assertUpsertBeforeDelete(
  'src/services/pigItinerarioEiService.js',
  'upsertPigItinerarioEi',
  'year,semestre,sort_order'
);
assertUpsertBeforeDelete(
  'src/services/pigTesoreriaPrevisionesService.js',
  'upsertPigTesoreriaPrevisiones',
  'year,bloque,sort_order'
);
assertUpsertBeforeDelete(
  'src/services/pigTesoreriaCajaCortoService.js',
  'upsertPigTesoreriaCajaCorto',
  'year,bloque,sort_order'
);

const pigPage = read('src/components/PIGPage.jsx');
assert(pigPage.includes('assertAutosavesOk(saveResults'), 'generateExcel debe validar resultados de autoguardado');
assert(pigPage.includes('no se cargaron los datos auxiliares'), 'generateExcel debe abortar si fallan cargas auxiliares');
assert(pigPage.includes('no se cargaron los saldos fiscales de IMPUESTOS'), 'generateExcel debe abortar si IMPUESTOS falla');

const formulas = read('src/utils/pigExcelFormulas.js');
assert(formulas.includes('IF(${gRef}<0,ABS(${gRef}),0)'), 'MOD 303 debe usar ABS en A PAGAR');
assert(formulas.includes('Math.abs(Number(cached303))'), 'MOD 303 debe cachear A PAGAR positivo');

const tesoreria = read('src/services/pigTesoreriaService.js');
assert(tesoreria.includes('Math.abs(mod303Sum)'), 'MOD 303 debe escribir A PAGAR positivo en AOA');

const impuestos = read('src/services/pigTesoreriaImpuestosService.js');
assert(impuestos.includes('impuestos: null'), 'IMPUESTOS no debe fabricar datos si Holded falla');
assert(impuestos.includes('sin saldos verificables'), 'IMPUESTOS debe exigir saldos verificables');

for (const rel of [
  'database/create_pig_itinerario_ei.sql',
  'database/create_pig_tesoreria_previsiones.sql',
  'database/create_pig_tesoreria_caja_corto.sql',
  'database/alter_pig_safe_upsert_constraints.sql'
]) {
  const sql = read(rel);
  assert(/unique\s*\(/i.test(sql), `${rel} debe definir claves unicas para upsert seguro`);
}

console.log('OK verify-pig-critical-regressions');
