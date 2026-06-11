/** Datos de empresa para documentos de firma (ajusta razón social si hace falta). */
export const FIRMA_EMPRESA_INFO = {
  EI_SSS: {
    nombre: 'SOLUCIONS SOCIALS SOSTENIBLES SCRL',
    corto: 'Solucions Socials'
  },
  MENJAR_DHORT: {
    nombre: "MENJAR D'HORT SCP",
    corto: "Menjar d'Hort"
  }
};

export function getFirmaEmpresaNombre(entityKey) {
  return FIRMA_EMPRESA_INFO[entityKey]?.nombre || String(entityKey || '');
}
