const fs = require('fs');
const path = require('path');

const sqlPath = path.join(__dirname, '..', 'database', 'alter_obrador_controls_no_saltables.sql');
const sql = fs.readFileSync(sqlPath, 'utf8');

function extractFunction(name) {
  const start = sql.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`);
  if (start === -1) throw new Error(`No se ha encontrado ${name}.`);
  const end = sql.indexOf('REVOKE ALL ON FUNCTION', start);
  if (end === -1) throw new Error(`No se ha encontrado el final de ${name}.`);
  return sql.slice(start, end);
}

const crearLot = extractFunction('obrador_crear_lot_i_etiqueta');
const crearExpedicio = extractFunction('obrador_crear_expedicio_i_marcar_lot');

if (!/SECURITY DEFINER/i.test(crearLot) || !/SECURITY DEFINER/i.test(crearExpedicio)) {
  throw new Error('El verificador espera RPCs SECURITY DEFINER.');
}

if (!crearLot.includes('public.obrador_is_management_user()')) {
  throw new Error('obrador_crear_lot_i_etiqueta debe validar rol management dentro del cuerpo.');
}

if (
  !crearExpedicio.includes('public.obrador_is_management_user()') ||
  !crearExpedicio.includes('public.obrador_is_portal_staff_user()')
) {
  throw new Error('obrador_crear_expedicio_i_marcar_lot debe validar management o portal staff dentro del cuerpo.');
}

const firstInsertLot = crearLot.indexOf('INSERT INTO obrador_lots');
const roleCheckLot = crearLot.indexOf('public.obrador_is_management_user()');
if (firstInsertLot !== -1 && roleCheckLot > firstInsertLot) {
  throw new Error('El rol de crear lot debe comprobarse antes de escribir.');
}

const firstInsertExpedicio = crearExpedicio.indexOf('INSERT INTO obrador_expedicions');
const roleCheckExpedicio = crearExpedicio.indexOf('public.obrador_is_management_user()');
if (firstInsertExpedicio !== -1 && roleCheckExpedicio > firstInsertExpedicio) {
  throw new Error('El rol de crear expedicion debe comprobarse antes de escribir.');
}

console.log('OK: RPCs Obrador SECURITY DEFINER validan rol antes de escribir.');
