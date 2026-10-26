const fs = require('fs');
const path = require('path');

const servicePath = path.join(__dirname, '..', 'src', 'services', 'obradorSupabaseService.js');
const source = fs.readFileSync(servicePath, 'utf8');

const match = source.match(/export async function setProducteProveidors\(idProducte, files\) \{[\s\S]*?\n\}/);
if (!match) {
  throw new Error('No s\'ha trobat setProducteProveidors().');
}

const body = match[0];
const upsertIndex = body.indexOf('.upsert(rows');
const deleteIndex = body.indexOf('.delete()');
const deleteAllProductIndex = body.indexOf(".delete()\n      .eq('id_producte', idProducte)");
const deleteByIdsIndex = body.indexOf(".delete()\n      .in('id', obsoletes)");

if (upsertIndex === -1) {
  throw new Error('setProducteProveidors() ha de inserir/upsertar abans de borrar.');
}

if (deleteIndex !== -1 && deleteIndex < upsertIndex && !/if \(!rows\.length\)/.test(body)) {
  throw new Error('setProducteProveidors() torna a borrar abans de guardar les files noves.');
}

if (deleteAllProductIndex !== -1) {
  throw new Error('setProducteProveidors() no pot fer delete(id_producte) perquè un insert fallit buida associacions.');
}

if (deleteByIdsIndex === -1) {
  throw new Error('setProducteProveidors() ha de borrar només els ids obsolets després de guardar.');
}

if (!body.includes("onConflict: 'id_producte,id_proveidor,ingredient_nom'")) {
  throw new Error('setProducteProveidors() ha d\'usar la clau única del schema en l\'upsert.');
}

console.log('OK: setProducteProveidors desa sense buidar associacions abans d\'inserir.');
