const fs = require('fs');
const path = require('path');

const servicePath = path.join(__dirname, '..', 'src', 'services', 'obradorSupabaseService.js');
const source = fs.readFileSync(servicePath, 'utf8');

const start = source.indexOf('export async function setProducteProveidors');
if (start === -1) {
  throw new Error('No s ha trobat setProducteProveidors().');
}

let depth = 0;
let end = -1;
const bodyStart = source.indexOf('{', start);
for (let i = bodyStart; i < source.length; i += 1) {
  const ch = source[i];
  if (ch === '{') depth += 1;
  if (ch === '}') depth -= 1;
  if (depth === 0) {
    end = i + 1;
    break;
  }
}

if (end === -1) {
  throw new Error('No s ha pogut extreure el cos de setProducteProveidors().');
}

const fn = source.slice(start, end);

if (!/\.upsert\(\s*rows\s*,\s*\{\s*onConflict:\s*['"]id_producte,id_proveidor,ingredient_nom['"]\s*\}\s*\)/.test(fn)) {
  throw new Error('setProducteProveidors() ha de fer upsert amb la clau unica abans de netejar obsolets.');
}

if (/\.insert\(\s*rows\s*\)/.test(fn)) {
  throw new Error('setProducteProveidors() no ha de tornar a insert(rows): pot fallar despres de borrar dades existents.');
}

const upsertIndex = fn.indexOf('.upsert(rows');
const obsoleteDeleteIndex = fn.indexOf(".in('id', idsObsolets)");
if (obsoleteDeleteIndex === -1 || obsoleteDeleteIndex < upsertIndex) {
  throw new Error('Les files obsoletes s han de borrar per id despres d un upsert correcte.');
}

if (!/if \(!rows\.length\)\s*\{[\s\S]*?\.delete\(\)[\s\S]*?\.eq\('id_producte', idProducte\)[\s\S]*?return \[\];[\s\S]*?\}/.test(fn)) {
  throw new Error('El cas explicit de llista buida ha de continuar eliminant totes les associacions.');
}

console.log('OK: setProducteProveidors evita delete(id_producte) abans d insertar les noves associacions.');
