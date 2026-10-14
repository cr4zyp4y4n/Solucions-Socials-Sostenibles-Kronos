const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const sqlFiles = [
  'database/alter_obrador_atomic_flows.sql',
  'database/alter_obrador_lot_multi_recepcio.sql'
];

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function extractCrearLotBody(sql, file) {
  const signature = /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.obrador_crear_lot_i_etiqueta\s*\(/i;
  const match = signature.exec(sql);
  assert(match, `${file}: no se ha encontrado la RPC obrador_crear_lot_i_etiqueta`);

  const start = sql.indexOf('BEGIN', match.index);
  const end = sql.indexOf('END;', start);
  assert(start !== -1 && end !== -1, `${file}: no se ha podido extraer el cuerpo de la RPC`);
  return sql.slice(start, end);
}

for (const file of sqlFiles) {
  const fullPath = path.join(root, file);
  const sql = fs.readFileSync(fullPath, 'utf8');
  const body = extractCrearLotBody(sql, file);
  const authIdx = body.search(/IF\s+NOT\s+public\.obrador_is_management_user\s*\(\s*\)\s+THEN/i);
  const firstWriteIdx = body.search(/\bINSERT\s+INTO\s+obrador_/i);

  assert(authIdx !== -1, `${file}: falta el guard obrador_is_management_user() en la RPC`);
  assert(firstWriteIdx !== -1, `${file}: no se ha encontrado ninguna escritura de obrador en la RPC`);
  assert(authIdx < firstWriteIdx, `${file}: el guard de gestión debe ejecutarse antes de escribir`);
}

console.log('OK verify-obrador-rpc-auth');
