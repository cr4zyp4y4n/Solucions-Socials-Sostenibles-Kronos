const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const atomicFlows = read('database/alter_obrador_atomic_flows.sql');
assert(
  atomicFlows.includes('IF NOT public.obrador_is_management_user() THEN')
    && atomicFlows.includes("No tens permisos per crear lots d''obrador."),
  'La RPC atomica de crear lot debe validar usuario de gestion'
);
assert(
  atomicFlows.includes('IF NOT public.obrador_is_portal_staff_user() THEN')
    && atomicFlows.includes("No tens permisos per crear expedicions d''obrador."),
  'La RPC de crear expedicion debe validar staff/gestion'
);

const multiLot = read('database/alter_obrador_lot_multi_recepcio.sql');
assert(
  multiLot.includes('IF NOT public.obrador_is_management_user() THEN')
    && multiLot.includes("No tens permisos per crear lots d''obrador."),
  'La RPC multi-recepcion de crear lot debe validar usuario de gestion'
);

const licitacions = read('database/create_licitacions.sql');
assert(
  !licitacions.includes('ON public.licitacions FOR DELETE TO authenticated USING (true)'),
  'Licitacions no debe permitir DELETE a cualquier usuario autenticado'
);
assert(
  licitacions.includes("lower(coalesce(up.role, '')) IN ('admin', 'management', 'manager')"),
  'Licitacions DELETE debe restringirse a roles privilegiados'
);

console.log('OK: guards Obrador y DELETE de licitaciones endurecidos.');
