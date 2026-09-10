const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertOrder(source, beforeNeedle, afterNeedle, message) {
  const before = source.indexOf(beforeNeedle);
  const after = source.indexOf(afterNeedle);
  assert(before >= 0, `No se encontro: ${beforeNeedle}`);
  assert(after >= 0, `No se encontro: ${afterNeedle}`);
  assert(before < after, message);
}

function verifyUniqueUpserts() {
  const objetivos = read('src/services/pigObjetivosComparativaService.js');
  assert(
    objetivos.includes(".upsert(payload, { onConflict: 'linea,year,variant' })"),
    'Objetivos debe usar upsert por clave unica, no delete(year)->insert(payload).'
  );
  assert(
    !/from\('pig_objetivos_comparativa'\)[\s\S]{0,120}\.delete\(\)[\s\S]{0,180}\.insert\(payload\)/.test(objetivos),
    'Objetivos reintrodujo delete(year)->insert(payload).'
  );

  const estimados = read('src/services/pigEstimadosSubvencionService.js');
  assert(
    estimados.includes(".upsert(payload, { onConflict: 'linea,year,slot,segment' })"),
    'Estimados debe usar upsert por clave unica antes de limpiar obsoletos.'
  );
  assertOrder(
    estimados,
    ".upsert(payload, { onConflict: 'linea,year,slot,segment' })",
    'const staleIds',
    'Estimados debe escribir antes de calcular/borrar tramos obsoletos.'
  );
}

function verifyInsertBeforeCleanup(rel, table) {
  const source = read(rel);
  assert(
    source.includes('previousRows') && source.includes('previousIds'),
    `${rel} debe seleccionar ids previos y limpiarlos solo despues de insertar.`
  );
  assertOrder(
    source,
    '.insert(payload)',
    'const previousIds',
    `${rel} debe insertar el payload antes de borrar filas antiguas.`
  );
  assert(
    !new RegExp(`from\\('${table}'\\)[\\s\\S]{0,120}\\.delete\\(\\)[\\s\\S]{0,220}if \\(!payload\\.length\\)`).test(source),
    `${rel} reintrodujo borrado del anio antes de comprobar/escribir payload no vacio.`
  );
}

function verifySafeSaves() {
  verifyUniqueUpserts();
  verifyInsertBeforeCleanup('src/services/pigItinerarioEiService.js', 'pig_itinerario_ei');
  verifyInsertBeforeCleanup('src/services/pigTesoreriaPrevisionesService.js', 'pig_tesoreria_previsiones');
  verifyInsertBeforeCleanup('src/services/pigTesoreriaCajaCortoService.js', 'pig_tesoreria_caja_corto');
}

function verifyExcelGuards() {
  const page = read('src/components/PIGPage.jsx');
  assert(
    page.includes('saveResults.some((ok) => ok === false)'),
    'generateExcel debe abortar si algun autoguardado devuelve false.'
  );
  assert(
    page.includes('falló la carga de IMPUESTOS') && page.includes('if (!impuestos)'),
    'generateExcel debe abortar si IMPUESTOS falla o no devuelve saldos verificables.'
  );
  assert(
    page.includes('falló la carga de TESORERÍA'),
    'generateExcel debe abortar si no se pueden cargar las cuentas de TESORERIA.'
  );
  assert(
    page.includes('falló la hoja TESORERÍA'),
    'generateExcel debe abortar si falla la construccion de la hoja TESORERIA.'
  );

  const impuestos = read('src/services/pigTesoreriaImpuestosService.js');
  assert(
    impuestos.includes('missingCodes') && impuestos.includes('impuestos: null'),
    'IMPUESTOS no debe fabricar ceros cuando Holded no devuelve saldos fiscales verificables.'
  );
  assert(
    impuestos.includes('lastDot') && impuestos.includes('lastComma'),
    'El parser de saldos fiscales debe soportar formatos ES y US sin truncar decimales.'
  );

  const tesoreria = read('src/services/pigTesoreriaService.js');
  assert(
    tesoreria.includes('mod303Sum < 0 ? Math.abs(mod303Sum)'),
    'MOD 303 en A PAGAR debe guardarse como importe positivo.'
  );

  const formulas = read('src/utils/pigExcelFormulas.js');
  assert(
    formulas.includes('IF(${gRef}<0,ABS(${gRef}),0)'),
    'La formula Excel de MOD 303 debe usar ABS para A PAGAR.'
  );
}

verifySafeSaves();
verifyExcelGuards();
console.log('OK: regresiones criticas PIG cubiertas.');
