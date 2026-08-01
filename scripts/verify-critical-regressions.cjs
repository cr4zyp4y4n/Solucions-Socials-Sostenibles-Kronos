const fs = require('fs');
const path = require('path');

function read(relativePath) {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const obradorSql = read('database/alter_obrador_lot_multi_recepcio.sql');
assert(
  /IF NOT public\.obrador_is_management_user\(\) THEN[\s\S]*No tens permisos/.test(obradorSql),
  'obrador_crear_lot_i_etiqueta debe validar management dentro del SECURITY DEFINER'
);
assert(
  /Cal seleccionar almenys una recepció per cada proveïdor associat/.test(obradorSql),
  'obrador_crear_lot_i_etiqueta debe exigir cobertura de todos los proveedores asociados'
);

const obradorService = read('src/services/obradorSupabaseService.js');
assert(
  !/from\('obrador_producte_proveidors'\)[\s\S]{0,120}\.delete\(\)[\s\S]{0,80}\.eq\('id_producte'/.test(obradorService),
  'setProducteProveidors no debe borrar todas las asociaciones antes de persistir reemplazos'
);
assert(
  /\.upsert\(rows,\s*\{\s*onConflict:\s*'id_producte,id_proveidor,ingredient_nom'\s*\}\)/.test(obradorService)
    && /\.in\('id', staleIds\)/.test(obradorService),
  'setProducteProveidors debe upsertar primero y borrar solo IDs obsoletos'
);

const licitacionsVigent = read('src/services/licitacionsVigent.js');
const licitacionsService = read('src/services/licitacionsService.js');
assert(
  /function hasLicitacioSeguiment/.test(licitacionsVigent)
    && /notes_paula/.test(licitacionsVigent)
    && /data_contacte/.test(licitacionsVigent)
    && /resultat_jc/.test(licitacionsVigent),
  'La purga de licitaciones debe proteger cualquier seguimiento humano'
);
assert(
  /\.select\('id, source, estat_contractacio, termini_oferta, estat_jc, notes_paula, data_contacte, resultat_jc'\)/.test(licitacionsService),
  'purgeCaducadasLicitacions debe cargar campos de seguimiento antes de decidir borrado'
);

const impuestosService = read('src/services/pigTesoreriaImpuestosService.js');
assert(
  /catch \(error\) \{[\s\S]*impuestos: null[\s\S]*error/.test(impuestosService)
    && !/catch \(error\) \{[\s\S]*balance: 0[\s\S]*error/.test(impuestosService),
  'Errores cargando impuestos Holded no deben transformarse en saldos cero'
);

const pigPage = read('src/components/PIGPage.jsx');
assert(
  /const saveResults = await Promise\.all\(\[saveEstimadosSubv\(\), saveObjetivosComparativa\(\)\]\);[\s\S]*saveResults\.some\(\(ok\) => ok === false\)/.test(pigPage),
  'generateExcel debe abortar si fallan guardados PIG previos'
);
assert(
  /const saveResults = await Promise\.all\(\[[\s\S]*saveObjetivosComparativa\(\),[\s\S]*saveItinerarioEi\(\),[\s\S]*saveTesoreriaPrevisiones\(\)[\s\S]*\]\);[\s\S]*saveResults\.some\(\(ok\) => ok === false\)/.test(pigPage),
  'generateExcel CR debe abortar si fallan guardados de objetivos/itinerario/previsiones'
);
assert(
  /impuestos: impuestosError[\s\S]*errorMessage/.test(pigPage),
  'La hoja TESORERÍA debe recibir un error explícito si fallan impuestos'
);

const licitacioModal = read('src/components/LicitacioDetailModal.jsx');
assert(
  /setCommentView\('compose'\);[\s\S]{0,80}setCardText\(''\);[\s\S]{0,80}setComposeText\(''\);/.test(licitacioModal),
  'El modal de licitaciones debe limpiar composeText cuando el registro no tiene nota'
);

console.log('OK critical regressions');
