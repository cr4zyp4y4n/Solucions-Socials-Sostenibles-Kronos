const fs = require('fs');
const path = require('path');

const servicePath = path.join(__dirname, '..', 'src', 'services', 'obradorSupabaseService.js');
const source = fs.readFileSync(servicePath, 'utf8');

const match = source.match(/export async function setProducteProveidors[\s\S]*?\n}\n\nexport async function getOperaris/);
if (!match) {
  throw new Error('No s\'ha trobat setProducteProveidors().');
}

const body = match[0];
const upsertIndex = body.indexOf('.upsert(');
const insertIndex = body.indexOf('.insert(');
const oldDeleteAllPattern = /\.from\('obrador_producte_proveidors'\)[\s\S]{0,120}\.delete\(\)[\s\S]{0,120}\.eq\('id_producte',\s*idProducte\)/;

if (upsertIndex === -1) {
  throw new Error('setProducteProveidors() ha de fer upsert abans de qualsevol esborrat.');
}

if (insertIndex !== -1) {
  throw new Error('setProducteProveidors() no ha de reintroduir inserts manuals en comptes d\'upsert.');
}

if (oldDeleteAllPattern.test(body)) {
  throw new Error('setProducteProveidors() torna a esborrar totes les associacions del producte abans de desar.');
}

if (!body.includes('clausNoves') || !body.includes('idsObsolets')) {
  throw new Error('setProducteProveidors() ha de calcular claus noves i esborrar només obsolets.');
}

console.log('OK: setProducteProveidors desa abans d\'esborrar associacions obsoletes.');
