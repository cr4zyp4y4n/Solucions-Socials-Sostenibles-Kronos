/** Datos de empresa para documentos de firma (ajusta razón social si hace falta). */
export const FIRMA_EMPRESA_INFO = {
  EI_SSS: {
    nombre: 'SOLUCIONS SOCIALS SOSTENIBLES SCRL',
    corto: 'Solucions Socials',
    nif: 'F67499186'
  },
  MENJAR_DHORT: {
    nombre: "MENJAR D'HORT SCP",
    corto: "Menjar d'Hort",
    nif: ''
  }
};

export function getFirmaEmpresaNombre(entityKey) {
  return FIRMA_EMPRESA_INFO[entityKey]?.nombre || String(entityKey || '');
}

export function getFirmaEmpresaStampLine(entityKey) {
  const info = FIRMA_EMPRESA_INFO[entityKey];
  if (!info) return '';
  if (info.nif) return `Emisor: ${info.corto} · NIF ${info.nif}`;
  return `Emisor: ${info.corto}`;
}
