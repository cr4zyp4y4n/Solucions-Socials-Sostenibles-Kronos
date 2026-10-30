/**
 * Mapeo empresa PIG (UI) → claves Holded API.
 * v1 usa `menjar`; v2 / env usan `menjar_dhort`.
 */

export function pigEmpresaToHoldedCompany(pigEmpresa) {
  return pigEmpresa === 'MH' ? 'menjar_dhort' : 'solucions';
}

/** Perfil de tesorería (IBANs, créditos, filas de obligaciones). */
export function pigTesoreriaProfile(pigEmpresa) {
  return pigEmpresa === 'MH' ? 'mh' : 'eisss';
}

/**
 * Resuelve la clave de API Holded (v1 o v2) aceptando alias.
 * @param {string} company
 * @returns {{ v2Key: string, v1Key: string }}
 */
export function resolveHoldedCompanyKeys(company = 'solucions') {
  const c = String(company || 'solucions').trim();
  if (c === 'menjar' || c === 'menjar_dhort') {
    return { v2Key: 'menjar_dhort', v1Key: 'menjar' };
  }
  return { v2Key: 'solucions', v1Key: 'solucions' };
}
