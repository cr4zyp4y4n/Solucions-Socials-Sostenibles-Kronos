const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function functionBlock(sql, name) {
  const start = sql.indexOf(`CREATE OR REPLACE FUNCTION public.${name}`);
  assert(start >= 0, `No se encuentra ${name}`);
  const rest = sql.slice(start);
  const endMarker = `REVOKE ALL ON FUNCTION public.${name}`;
  const end = rest.indexOf(endMarker);
  assert(end >= 0, `No se encuentra REVOKE de ${name}`);
  return rest.slice(0, end);
}

function verifyCreateLot(rel) {
  const block = functionBlock(read(rel), 'obrador_crear_lot_i_etiqueta');
  assert(/SECURITY\s+DEFINER/i.test(block), `${rel}: crear lot debe ser SECURITY DEFINER`);
  assert(block.includes('public.obrador_is_management_user()'), `${rel}: crear lot debe validar management dentro de la RPC`);
}

function verifyExpedicio(rel) {
  const block = functionBlock(read(rel), 'obrador_crear_expedicio_i_marcar_lot');
  assert(/SECURITY\s+DEFINER/i.test(block), `${rel}: expedir debe ser SECURITY DEFINER`);
  assert(block.includes('public.obrador_is_management_user()'), `${rel}: expedir debe permitir management explícitamente`);
  assert(block.includes('public.obrador_is_portal_staff_user()'), `${rel}: expedir debe validar portal staff explícitamente`);
  assert(block.includes('IF NOT COALESCE(p_check_sortida, false)'), `${rel}: expedir debe exigir check_sortida`);
  assert(block.includes("NULLIF(btrim(COALESCE(p_id_client, '')), '') IS NULL"), `${rel}: expedir debe exigir cliente no vacío`);
  assert(/FOR\s+UPDATE/i.test(block), `${rel}: expedir debe bloquear el lote con FOR UPDATE`);
  assert(/EXISTS\s*\(\s*SELECT\s+1\s+FROM\s+(public\.)?obrador_expedicions\s+WHERE\s+id_lot\s*=\s*p_id_lot\s*\)/i.test(block), `${rel}: expedir debe detectar expedición previa`);
  assert(/VALUES\s*\([\s\S]*\btrue\b[\s\S]*COALESCE\(p_check_client,\s*false\)/i.test(block), `${rel}: expedir debe persistir check_sortida=true tras validarlo`);
}

[
  'database/alter_obrador_atomic_flows.sql',
  'database/alter_obrador_lot_multi_recepcio.sql',
  'database/alter_obrador_rpc_authorization_hardening.sql'
].forEach(verifyCreateLot);

[
  'database/alter_obrador_atomic_flows.sql',
  'database/alter_obrador_expedicions_unique_lot.sql',
  'database/alter_obrador_check_sortida_required.sql',
  'database/alter_obrador_rpc_authorization_hardening.sql'
].forEach(verifyExpedicio);

console.log('OK obrador RPC hardening');
