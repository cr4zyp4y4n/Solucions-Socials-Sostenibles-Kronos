const fs = require('fs');
const path = require('path');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const file = path.resolve(__dirname, '../src/services/pigTesoreriaPrevisionesService.js');
const src = fs.readFileSync(file, 'utf8');
const fnMatch = /export\s+async\s+function\s+upsertPigTesoreriaPrevisiones[\s\S]+?\n}\n/.exec(src);

assert(fnMatch, 'No se ha encontrado upsertPigTesoreriaPrevisiones');

const body = fnMatch[0];
const insertIdx = body.indexOf('.insert(payload)');
const deleteIdx = body.indexOf('.delete()');

assert(insertIdx !== -1, 'El guardado debe insertar el payload de previsiones');
assert(deleteIdx !== -1, 'El guardado debe borrar las filas antiguas tras reemplazar');
assert(insertIdx < deleteIdx, 'El borrado de previsiones antiguas no debe ejecutarse antes del insert correcto');
assert(
  /select\('id'\)[\s\S]+?const oldIds =/.test(body),
  'El reemplazo seguro debe cargar ids antiguos antes de insertar filas nuevas'
);

console.log('OK verify-pig-previsiones-safe-save');
