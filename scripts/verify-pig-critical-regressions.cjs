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

function assertNoDeleteBeforeWrite(rel, fnName) {
  const src = read(rel);
  const fnStart = src.indexOf(`export async function ${fnName}`);
  assert(fnStart >= 0, `${rel}: no se encuentra ${fnName}`);
  const fnBody = src.slice(fnStart, src.indexOf('\n}', fnStart) + 2);
  const writeIdx = Math.min(
    ...[fnBody.indexOf('.insert('), fnBody.indexOf('.upsert(')].filter((idx) => idx >= 0)
  );
  const cleanupIdx = fnBody.indexOf(".not('id', 'in'");
  assert(writeIdx >= 0, `${rel}: ${fnName} no escribe datos`);
  assert(cleanupIdx > writeIdx, `${rel}: ${fnName} debe limpiar obsoletos despues de escribir`);
}

assert(read('src/services/pigObjetivosComparativaService.js').includes(".upsert(payload, { onConflict: 'linea,year,variant' })"),
  'Objetivos debe usar upsert por clave unica.');
assertNoDeleteBeforeWrite('src/services/pigEstimadosSubvencionService.js', 'upsertPigEstimadosSubvencion');
assertNoDeleteBeforeWrite('src/services/pigItinerarioEiService.js', 'upsertPigItinerarioEi');
assertNoDeleteBeforeWrite('src/services/pigTesoreriaPrevisionesService.js', 'upsertPigTesoreriaPrevisiones');
assertNoDeleteBeforeWrite('src/services/obradorSupabaseService.js', 'setProducteProveidors');

const pigPage = read('src/components/PIGPage.jsx');
assert(pigPage.includes('ensureSaved('), 'generateExcel debe validar resultados de autoguardados.');
assert(pigPage.includes('throw new Error(\'No se han podido cargar los datos auxiliares del año del PIG.\')'),
  'generateExcel debe abortar si fallan cargas auxiliares.');
assert(pigPage.includes("console.error('Error generando hoja TESORERÍA:', e);\n          throw e;"),
  'TESORERÍA no debe silenciar errores criticos.');

const impuestos = read('src/services/pigTesoreriaImpuestosService.js');
assert(impuestos.includes('impuestos: null'), 'Impuestos no debe fabricar ceros en catch.');
assert(impuestos.includes('Holded no ha devuelto cuentas fiscales MOD 303 con saldo verificable'),
  'Impuestos debe exigir saldos MOD 303 verificables.');

const obradorSql = read('database/alter_obrador_lot_multi_recepcio.sql');
assert(obradorSql.includes('IF NOT public.obrador_is_management_user() THEN'),
  'RPC obrador_crear_lot_i_etiqueta debe validar management dentro de SECURITY DEFINER.');

console.log('OK critical PIG/Obrador regressions guarded');
