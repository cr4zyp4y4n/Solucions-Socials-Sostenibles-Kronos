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

function indexOfOrThrow(source, needle, file) {
  const idx = source.indexOf(needle);
  assert(idx >= 0, `${file}: no se encontró "${needle}"`);
  return idx;
}

function assertNoDestructiveReplace(relPath) {
  const source = read(relPath).replace(/\s+/g, ' ');
  assert(
    !/if \(!payload\.length\).*?\.delete\(\)\s*\.eq\('year', y\).*?\.insert\(payload\)/.test(source),
    `${relPath}: no debe borrar el año antes de insertar el reemplazo`
  );
}

[
  'src/services/pigObjetivosComparativaService.js',
  'src/services/pigEstimadosSubvencionService.js'
].forEach(assertNoDestructiveReplace);

const objetivos = read('src/services/pigObjetivosComparativaService.js');
assert(objetivos.includes(".upsert(payload, { onConflict: 'linea,year,variant' })"), 'objetivos: debe usar upsert por clave natural');

const estimados = read('src/services/pigEstimadosSubvencionService.js');
assert(estimados.includes("'ESTRUCTURA'"), 'estimados: debe conservar la línea ESTRUCTURA');
assert(estimados.includes(".upsert(payload, { onConflict: 'linea,year,slot,segment' })"), 'estimados: debe usar upsert por clave natural');

for (const relPath of [
  'src/services/pigItinerarioEiService.js',
  'src/services/pigTesoreriaPrevisionesService.js'
]) {
  const source = read(relPath);
  const insertIdx = indexOfOrThrow(source, '.insert(payload)', relPath);
  const oldIdsIdx = indexOfOrThrow(source, 'const oldIds = (existingRows || [])', relPath);
  const deleteOldIdx = source.indexOf('.delete()', oldIdsIdx);
  assert(deleteOldIdx > insertIdx, `${relPath}: debe insertar el reemplazo antes de borrar filas antiguas`);
}

const createEstimadosSql = read('database/create_pig_estimados_subvencion.sql');
const alterEstimadosSql = read('database/alter_pig_estimados_subvencion_estructura.sql');
assert(createEstimadosSql.includes("'ESTRUCTURA'"), 'SQL base: debe permitir ESTRUCTURA');
assert(alterEstimadosSql.includes('drop constraint if exists pig_estimados_subvencion_linea_chk'), 'SQL alter: debe reemplazar el CHECK anterior');

const pigPage = read('src/components/PIGPage.jsx');
assert(pigPage.includes('assertAllSaved(saveResults'), 'PIGPage: el export debe abortar si falla un autoguardado');
assert(pigPage.includes('Espera a que terminen de cargar los datos auxiliares'), 'PIGPage: el export debe bloquear datos auxiliares cargando');
assert(pigPage.includes('No se pudieron cargar saldos verificables de IMPUESTOS desde Holded'), 'PIGPage: el export debe abortar sin IMPUESTOS verificables');
const warnIdx = indexOfOrThrow(pigPage, "console.warn('PIG TESORERÍA IMPUESTOS", 'PIGPage');
const throwIdx = indexOfOrThrow(pigPage, "throw new Error(describeAsyncError('No se pudieron cargar saldos verificables de IMPUESTOS desde Holded'", 'PIGPage');
assert(throwIdx > warnIdx, 'PIGPage: el error de IMPUESTOS debe cortar el flujo tras registrarse');

const impuestos = read('src/services/pigTesoreriaImpuestosService.js');
assert(impuestos.includes('impuestos: null'), 'IMPUESTOS: no debe devolver bloques con ceros fabricados en catch');
assert(impuestos.includes('missingCodes'), 'IMPUESTOS: debe detectar cuentas fiscales sin saldo verificable');
assert(impuestos.includes("raw.replace(/\\./g, '').replace(',', '.')"), 'IMPUESTOS: debe parsear importes europeos con separador de miles');

const tesoreria = read('src/services/pigTesoreriaService.js');
assert(tesoreria.includes('Math.abs(mod303Sum)'), 'TESORERÍA: MOD 303 negativo debe mostrarse como pago positivo');

const formulas = read('src/utils/pigExcelFormulas.js');
assert(formulas.includes('ABS('), 'Fórmulas: MOD 303 negativo debe usar ABS en A PAGAR');

console.log('OK: regresiones críticas PIG cubiertas');
