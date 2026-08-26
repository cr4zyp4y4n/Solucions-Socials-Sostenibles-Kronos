const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function fail(message) {
  throw new Error(message);
}

function bodyOf(source, fnName) {
  const start = source.indexOf(`export async function ${fnName}`);
  if (start === -1) fail(`No se encuentra ${fnName}`);
  const brace = source.indexOf('{', start);
  let depth = 0;
  for (let i = brace; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(brace, i + 1);
    }
  }
  fail(`No se pudo delimitar ${fnName}`);
}

function assertNoDeleteBeforeWrite(rel, fnName) {
  const body = bodyOf(read(rel), fnName);
  const deleteIdx = body.indexOf('.delete()');
  const writeCandidates = [body.indexOf('.upsert('), body.indexOf('.insert(payload)')]
    .filter((idx) => idx >= 0);
  const firstWrite = Math.min(...writeCandidates);
  if (deleteIdx >= 0 && (writeCandidates.length === 0 || deleteIdx < firstWrite)) {
    fail(`${rel}:${fnName} vuelve a borrar antes de escribir; riesgo de pérdida de datos si falla la escritura.`);
  }
}

assertNoDeleteBeforeWrite('src/services/pigObjetivosComparativaService.js', 'upsertPigObjetivosComparativa');
assertNoDeleteBeforeWrite('src/services/pigEstimadosSubvencionService.js', 'upsertPigEstimadosSubvencion');
assertNoDeleteBeforeWrite('src/services/pigItinerarioEiService.js', 'upsertPigItinerarioEi');
assertNoDeleteBeforeWrite('src/services/pigTesoreriaPrevisionesService.js', 'upsertPigTesoreriaPrevisiones');

const pigPage = read('src/components/PIGPage.jsx');
if (!pigPage.includes('assertAllSaved(')) {
  fail('PIGPage.generateExcel debe abortar si fallan los autoguardados editables.');
}
if (!pigPage.includes('No se ha generado el Excel: no se pudieron cargar IMPUESTOS desde Holded')) {
  fail('PIGPage.generateExcel debe abortar si IMPUESTOS no carga desde Holded.');
}
if (!/catch \(e\) \{\s*console\.error\('Error generando hoja TESORERÍA:'[\s\S]*?throw e;/m.test(pigPage)) {
  fail('La hoja TESORERÍA no debe tragar errores críticos y continuar escribiendo el Excel.');
}

const tesoreriaService = read('src/services/pigTesoreriaService.js');
if (/const aPagar303 = mod303Sum < 0 \? mod303Sum : ''/.test(tesoreriaService)) {
  fail('MOD 303 no puede escribirse negativo en A PAGAR.');
}
if (!tesoreriaService.includes('const aPagar303 = mod303Sum < 0 ? Math.abs(mod303Sum) : \'\';')) {
  fail('MOD 303 debe escribirse como importe positivo en A PAGAR.');
}

console.log('OK: regresiones críticas PIG cubiertas.');
