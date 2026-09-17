/** Datos de empresa para el sello de firma en el portal. */
export const FIRMA_EMPRESA_INFO: Record<
  string,
  { nombre: string; corto: string; nif: string }
> = {
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

export function getFirmaEmpresaStampLine(entityKey?: string | null): string {
  const key = String(entityKey || '').trim();
  const info = FIRMA_EMPRESA_INFO[key];
  if (!info) return '';
  if (info.nif) return `Emisor: ${info.corto} · NIF ${info.nif}`;
  return `Emisor: ${info.corto}`;
}
