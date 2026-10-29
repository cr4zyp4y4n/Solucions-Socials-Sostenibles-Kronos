const fs = require('fs');
const path = require('path');

const servicePath = path.join(__dirname, '..', 'src', 'services', 'obradorSupabaseService.js');
const source = fs.readFileSync(servicePath, 'utf8');

const match = source.match(/export async function setProducteProveidors\([\s\S]*?\n}\n/);
if (!match) {
  throw new Error('No se ha encontrado setProducteProveidors().');
}

const fn = match[0];
const upsertIndex = fn.indexOf('.upsert(');
const deleteIndex = fn.indexOf('.delete()');
const insertIndex = fn.indexOf('.insert(');

if (insertIndex !== -1) {
  throw new Error('setProducteProveidors no debe usar insert(): reintroduce riesgo de fallo tras borrar.');
}

if (upsertIndex === -1) {
  throw new Error('setProducteProveidors debe guardar la version nueva con upsert antes de borrar obsoletos.');
}

if (deleteIndex !== -1 && deleteIndex < upsertIndex) {
  throw new Error('setProducteProveidors borra asociaciones antes de guardar la version nueva.');
}

if (!fn.includes('idsObsolets') || !fn.includes('.in(')) {
  throw new Error('setProducteProveidors debe borrar solo asociaciones obsoletas por id.');
}

console.log('OK: setProducteProveidors guarda sin delete-before-insert.');
