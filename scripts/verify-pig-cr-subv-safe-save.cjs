const fs = require('fs');
const path = require('path');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const servicePath = path.join(__dirname, '..', 'src', 'services', 'pigCrSubvEjerciciosAnterioresService.js');
const src = fs.readFileSync(servicePath, 'utf8');

const fnMatch = src.match(/export async function upsertPigCrSubvEjerciciosAnteriores[\s\S]*?\n}\n/);
assert(fnMatch, 'No se ha encontrado upsertPigCrSubvEjerciciosAnteriores');

const fn = fnMatch[0];
const selectIdx = fn.indexOf(".select('id')");
const insertIdx = fn.indexOf('.insert(payload)');
const deleteIdx = fn.indexOf('.delete()');
const deleteByYear = /\.delete\(\)[\s\S]{0,120}\.eq\('year',\s*y\)/.test(fn);
const deleteById = /\.delete\(\)[\s\S]{0,160}\.in\('id',\s*existingIds\)/.test(fn);

assert(selectIdx >= 0, 'El guardado debe capturar primero los ids existentes');
assert(insertIdx >= 0, 'El guardado debe insertar la nueva version antes de borrar la antigua');
assert(deleteIdx > insertIdx, 'No se debe borrar antes de que el insert haya tenido exito');
assert(!deleteByYear, 'No reintroducir delete().eq("year", y): puede vaciar el año si falla el insert');
assert(deleteById, 'El borrado posterior debe limitarse a los ids existentes antes del insert');

console.log('OK pig CR subvenciones ejercicios anteriores safe save');
