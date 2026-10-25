const fs = require('fs');
const path = require('path');

const migrationPath = path.join(
  __dirname,
  '..',
  'database',
  'alter_obrador_rpc_authorization_hardening.sql'
);

const sql = fs.readFileSync(migrationPath, 'utf8');

function extractFunction(name) {
  const start = sql.indexOf(`CREATE OR REPLACE FUNCTION public.${name}`);
  if (start === -1) {
    throw new Error(`No se ha encontrado la función ${name}`);
  }
  const bodyStart = sql.indexOf('AS $$', start);
  if (bodyStart === -1) {
    throw new Error(`No se ha encontrado el cuerpo de ${name}`);
  }
  const bodyEnd = sql.indexOf('$$;', bodyStart + 5);
  if (bodyEnd === -1) {
    throw new Error(`No se ha encontrado el cierre del cuerpo de ${name}`);
  }
  return sql.slice(bodyStart, bodyEnd);
}

function assertIncludes(body, pattern, message) {
  if (!pattern.test(body)) {
    throw new Error(message);
  }
}

const crearLot = extractFunction('obrador_crear_lot_i_etiqueta');
assertIncludes(
  crearLot,
  /IF\s+NOT\s+public\.obrador_is_management_user\(\)\s+THEN/i,
  'obrador_crear_lot_i_etiqueta debe exigir rol management dentro del cuerpo SECURITY DEFINER'
);

const crearExpedicio = extractFunction('obrador_crear_expedicio_i_marcar_lot');
assertIncludes(
  crearExpedicio,
  /public\.obrador_is_management_user\(\)[\s\S]*OR[\s\S]*public\.obrador_is_portal_staff_user\(\)/i,
  'obrador_crear_expedicio_i_marcar_lot debe exigir management o portal staff dentro del cuerpo SECURITY DEFINER'
);
assertIncludes(
  crearExpedicio,
  /IF\s+NOT\s*\(/i,
  'obrador_crear_expedicio_i_marcar_lot debe bloquear usuarios sin rol autorizado'
);

console.log('OK: RPCs Obrador SECURITY DEFINER contienen guardas de autorización.');
