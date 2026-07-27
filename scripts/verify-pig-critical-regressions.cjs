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

function removePayloadEmptyBranches(source) {
  let output = source;
  const needle = 'if (!payload.length) {';
  let start = output.indexOf(needle);
  while (start !== -1) {
    let idx = start + needle.length;
    let depth = 1;
    while (idx < output.length && depth > 0) {
      if (output[idx] === '{') depth += 1;
      if (output[idx] === '}') depth -= 1;
      idx += 1;
    }
    output = `${output.slice(0, start)}${output.slice(idx)}`;
    start = output.indexOf(needle);
  }
  return output;
}

function assertNoDeleteBeforeInsert(relPath, tableName) {
  const source = removePayloadEmptyBranches(read(relPath));
  const destructivePattern = new RegExp(
    `from\\('${tableName}'\\)[\\s\\S]{0,120}\\.delete\\(\\)[\\s\\S]{0,260}\\.eq\\('year', y\\)[\\s\\S]{0,700}\\.(?:insert|upsert)\\(`,
    'm'
  );
  assert(
    !destructivePattern.test(source),
    `${relPath} vuelve a borrar el año antes de escribir ${tableName}`
  );
}

assertNoDeleteBeforeInsert('src/services/pigItinerarioEiService.js', 'pig_itinerario_ei');
assertNoDeleteBeforeInsert('src/services/pigTesoreriaPrevisionesService.js', 'pig_tesoreria_previsiones');
assertNoDeleteBeforeInsert('src/services/pigEstimadosSubvencionService.js', 'pig_estimados_subvencion');
assertNoDeleteBeforeInsert('src/services/pigObjetivosComparativaService.js', 'pig_objetivos_comparativa');

const estimados = read('src/services/pigEstimadosSubvencionService.js');
assert(
  estimados.includes(".upsert(payload, { onConflict: 'linea,year,slot,segment' })"),
  'Estimados debe hacer upsert por clave única antes de borrar sobrantes'
);
assert(
  /const activeKeys = new Set\(payload\.map/.test(estimados) && /\.delete\(\)[\s\S]{0,80}\.in\('id', staleIds\)/.test(estimados),
  'Estimados debe borrar solo ids sobrantes tras un upsert correcto'
);

const objetivos = read('src/services/pigObjetivosComparativaService.js');
assert(
  objetivos.includes(".upsert(payload, { onConflict: 'linea,year,variant' })"),
  'Objetivos debe hacer upsert por clave única, no reemplazo destructivo'
);

for (const relPath of [
  'src/services/pigTesoreriaPrevisionesService.js',
  'src/services/pigEstimadosSubvencionService.js',
  'src/services/pigObjetivosComparativaService.js',
  'src/services/pigCateringHoldedEstimatesService.js'
]) {
  const source = read(relPath);
  assert(source.includes('function normalizeDecimalText'), `${relPath} debe aceptar punto decimal sin truncar importes`);
}

const previsiones = read('src/services/pigTesoreriaPrevisionesService.js');
assert(
  !/previsiones\.ingresos_por_subv = cloneDefaults\(\)\.ingresos_por_subv/.test(previsiones)
    && !/previsiones\.por_aprobar = cloneDefaults\(\)\.por_aprobar/.test(previsiones),
  'Previsiones no debe reinyectar defaults en bloques vacíos persistidos'
);

const itinerario = read('src/services/pigItinerarioEiService.js');
assert(
  !/itinerario\.semestre1 = cloneDefaults\(\)\.semestre1/.test(itinerario)
    && !/itinerario\.semestre2 = cloneDefaults\(\)\.semestre2/.test(itinerario),
  'Itinerario no debe reinyectar defaults en semestres vacíos persistidos'
);

const holded = read('src/services/pigCateringHoldedEstimatesService.js');
assert(
  /return total;\s*\}\s*function getEstimateTotal/.test(holded),
  'Presupuestos catering debe usar total como fallback si no hay subtotal'
);

const pigPage = read('src/components/PIGPage.jsx');
assert(pigPage.includes('const pigAuxBusy ='), 'PIGPage debe calcular estado ocupado de datos auxiliares');
assert(
  pigPage.includes("setError('Espera a que termine la carga/guardado de datos PIG antes de generar el Excel.');"),
  'generateExcel debe bloquearse durante carga/guardado auxiliar'
);
assert(
  pigPage.includes("No se pudo guardar la configuración PIG. No se ha generado el Excel.")
    && pigPage.includes("No se pudieron guardar los datos de Cuenta Resultados. No se ha generado el Excel."),
  'generateExcel debe abortar si falla un autoguardado crítico'
);

const modal = read('src/components/LicitacioDetailModal.jsx');
assert(
  /else \{\s*setCommentView\('compose'\);\s*setCardText\(''\);\s*setComposeText\(''\);/.test(modal),
  'El modal debe limpiar composeText al abrir una licitación sin comentario'
);

console.log('OK: regresiones críticas PIG/Licitaciones cubiertas');
