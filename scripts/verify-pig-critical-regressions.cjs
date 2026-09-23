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

function assertNoDeleteBeforeInsert(rel, functionName) {
  const src = read(rel);
  const start = src.indexOf(`export async function ${functionName}`);
  assert(start >= 0, `${rel}: no se encontró ${functionName}`);
  const end = src.indexOf('\n}', start);
  const body = src.slice(start, end === -1 ? undefined : end);
  const deleteIdx = body.indexOf('.delete()');
  const insertIdx = body.search(/\.(insert|upsert)\(/);
  assert(
    deleteIdx === -1 || insertIdx === -1 || insertIdx < deleteIdx,
    `${rel}: ${functionName} vuelve a borrar antes de escribir`
  );
}

[
  ['src/services/pigCrSubvEjerciciosAnterioresService.js', 'upsertPigCrSubvEjerciciosAnteriores'],
  ['src/services/pigTesoreriaCajaCortoService.js', 'upsertPigTesoreriaCajaCorto'],
  ['src/services/pigItinerarioEiService.js', 'upsertPigItinerarioEi'],
  ['src/services/pigTesoreriaPrevisionesService.js', 'upsertPigTesoreriaPrevisiones'],
  ['src/services/pigObjetivosComparativaService.js', 'upsertPigObjetivosComparativa']
].forEach(([rel, fn]) => assertNoDeleteBeforeInsert(rel, fn));

const estimados = read('src/services/pigEstimadosSubvencionService.js');
assert(
  /if \(!payload\.length\) \{[\s\S]*\.delete\(\)[\s\S]*return \{ error: deleteError \};[\s\S]*const \{ data: existingRows/.test(estimados),
  'estimados solo puede borrar antes de escribir cuando el payload está vacío'
);
assert(
  /\.upsert\(payload, \{ onConflict: 'linea,year,slot,segment' \}\)[\s\S]*obsoleteIds[\s\S]*\.delete\(\)[\s\S]*\.in\('id', obsoleteIds\)/.test(estimados),
  'estimados debe hacer upsert antes de borrar tramos obsoletos'
);

const helper = read('src/services/pigSafeReplaceService.js');
assert(
  /select\('id'\)[\s\S]*\.insert\(rows\)[\s\S]*deleteRowsByIds/.test(helper),
  'pigSafeReplaceService debe insertar el payload no vacío antes de borrar IDs antiguos'
);

const pigPage = read('src/components/PIGPage.jsx');
assert(
  /const saveResults = await Promise\.all\([\s\S]*saveEstimadosSubv\(\)[\s\S]*saveObjetivosComparativa\(\)[\s\S]*saveItinerarioEi\(\)[\s\S]*saveResults\.some\(\(ok\) => ok !== true\)/.test(pigPage),
  'generateExcel debe abortar si fallan autoguardados PIG Normal'
);
assert(
  /const saveResults = await Promise\.all\([\s\S]*saveTesoreriaPrevisiones\(\)[\s\S]*saveCrSubvEjAnteriores\(\)[\s\S]*saveResults\.some\(\(ok\) => ok !== true\)/.test(pigPage),
  'generateExcel debe abortar si fallan autoguardados de Cuenta Resultados'
);
assert(
  /if \(treasuryError\)[\s\S]*throw new Error\(`No se pudieron cargar las cuentas de TESORERÍA/.test(pigPage),
  'generateExcel debe abortar si falla la carga de TESORERÍA'
);
assert(
  /if \(impuestosError\)[\s\S]*throw new Error\(`No se pudieron cargar saldos fiscales/.test(pigPage),
  'generateExcel debe abortar si falla IMPUESTOS'
);

const impuestos = read('src/services/pigTesoreriaImpuestosService.js');
assert(
  /impuestos: null,[\s\S]*error: new Error\('Holded no devolvió plan contable/.test(impuestos),
  'loadPigImpuestosBalances debe rechazar plan contable vacío'
);
assert(
  /missingFiscalCodes[\s\S]*impuestos: null/.test(impuestos),
  'loadPigImpuestosBalances debe rechazar saldos fiscales no verificables'
);
assert(
  /lastIndexOf\(', '\)/.test(impuestos) || /lastIndexOf\(','\) > s\.lastIndexOf\('\.'\)/.test(impuestos),
  'parseBalance debe distinguir formatos US/ES cuando hay coma y punto'
);
assert(
  /catch \(error\) \{[\s\S]*impuestos: null,[\s\S]*error[\s\S]*\}/.test(impuestos),
  'loadPigImpuestosBalances no debe fabricar IMPUESTOS a cero en catch'
);

console.log('OK: regresiones críticas PIG cubiertas');
