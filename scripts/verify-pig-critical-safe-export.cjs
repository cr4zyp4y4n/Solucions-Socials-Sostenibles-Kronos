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

const objetivos = read('src/services/pigObjetivosComparativaService.js');
const estimados = read('src/services/pigEstimadosSubvencionService.js');
const itinerario = read('src/services/pigItinerarioEiService.js');
const previsiones = read('src/services/pigTesoreriaPrevisionesService.js');
const pigPage = read('src/components/PIGPage.jsx');

for (const [name, source] of [
  ['objetivos', objetivos],
  ['estimados', estimados],
  ['itinerario', itinerario],
  ['previsiones', previsiones]
]) {
  assert(
    !/\.delete\(\)\s*\.eq\('year',\s*y\)/.test(source),
    `${name}: no debe borrar todo el año antes de confirmar la escritura nueva`
  );
}

assert(
  /\.upsert\(payload,\s*\{\s*onConflict:\s*'linea,year,variant'\s*\}\)/.test(objetivos),
  'objetivos: debe guardar con upsert por clave única'
);

assert(
  /\.select\('id, linea, slot, segment'\)[\s\S]*\.upsert\(payload,\s*\{\s*onConflict:\s*'linea,year,slot,segment'\s*\}\)[\s\S]*obsoleteIds/.test(estimados),
  'estimados: debe consultar filas existentes, upsertar y borrar solo tramos obsoletos después'
);

for (const [name, source] of [
  ['itinerario', itinerario],
  ['previsiones', previsiones]
]) {
  assert(
    /\.select\('id'\)[\s\S]*\.insert\(payload\)[\s\S]*\.delete\(\)[\s\S]*\.in\('id', existingIds\)/.test(source),
    `${name}: debe insertar el reemplazo antes de borrar IDs antiguos`
  );
}

assert(
  (pigPage.match(/!saveResults\.every\(Boolean\)/g) || []).length >= 2,
  'PIGPage: generateExcel debe abortar si falla algún autoguardado'
);

assert(
  pigPage.includes('auxiliaryPigDataLoading')
    && pigPage.includes('Espera a que terminen de cargar objetivos, estimados, itinerario y previsiones'),
  'PIGPage: generateExcel debe esperar a que carguen los datos auxiliares'
);

assert(
  pigPage.includes('No se pudieron cargar los impuestos desde Holded')
    && /if \(impuestosError\)[\s\S]*throw new Error\('No se pudieron cargar los impuestos desde Holded/.test(pigPage),
  'PIGPage: generateExcel debe abortar si falla la carga de impuestos'
);

console.log('OK: invariantes críticos PIG protegidos.');
