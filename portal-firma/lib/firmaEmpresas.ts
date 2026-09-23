/** Datos de empresa para el sello / hoja de evidencias en el portal. */
export type FirmaEmpresaInfo = { nombre: string; corto: string; nif: string };

export const FIRMA_EMPRESA_INFO: Record<string, FirmaEmpresaInfo> = {
  EI_SSS: {
    nombre: 'SOLUCIONS SOCIALS SOSTENIBLES SCRL',
    corto: 'Solucions Socials',
    nif: 'F67499186'
  },
  MENJAR_DHORT: {
    nombre: "MENJAR D'HORT SCP",
    corto: "Menjar d'Hort",
    // Completar NIF/CIF real cuando se confirme
    nif: ''
  }
};

export function getFirmaEmpresaInfo(entityKey?: string | null): FirmaEmpresaInfo | null {
  const key = String(entityKey || '').trim();
  return FIRMA_EMPRESA_INFO[key] || null;
}

export function getFirmaEmpresaStampLine(entityKey?: string | null): string {
  const info = getFirmaEmpresaInfo(entityKey);
  if (!info) return '';
  if (info.nif) return `Emisor: ${info.corto} · NIF ${info.nif}`;
  return `Emisor: ${info.corto}`;
}
