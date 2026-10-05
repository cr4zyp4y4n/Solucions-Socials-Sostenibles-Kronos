/**
 * Tipos de documento para envíos de firma (contratación y RRHH).
 */
export const FIRMA_DOCUMENTO_GRUPOS = [
  {
    key: 'contratacion',
    label: 'Contratación',
    tipos: [
      { value: 'contrato', label: 'Contrato de trabajo' },
      { value: 'anexo', label: 'Anexo contractual' },
      { value: 'oferta_empleo', label: 'Oferta / propuesta de empleo' }
    ]
  },
  {
    key: 'prl',
    label: 'Prevención y PRL',
    tipos: [
      { value: 'riesgos_laborales', label: 'Información RPT – riesgos del puesto' },
      { value: 'riesgos_psicosociales', label: 'Protocolo de riesgos psicosociales' },
      { value: 'epis', label: 'Entrega e información de EPIS' },
      {
        value: 'vrp',
        label: 'Aceptación o renuncia del reconocimiento médico (VRP)'
      },
      { value: 'formacion_prl', label: 'Formación / información PRL' }
    ]
  },
  {
    key: 'politicas',
    label: 'Políticas y normativa interna',
    tipos: [
      { value: 'acoso', label: 'Protocolo de prevención del acoso' },
      { value: 'pdp', label: 'Protección de datos (RGPD)' },
      { value: 'confidencialidad', label: 'Compromiso de confidencialidad' },
      { value: 'registro_horario', label: 'Información registro horario' },
      { value: 'normas_internas', label: 'Normas internas / manual empleado' },
      { value: 'igualdad', label: 'Política de igualdad' }
    ]
  },
  {
    key: 'otros',
    label: 'Otros',
    tipos: [
      { value: 'baja', label: 'Baja / fin de relación laboral' },
      { value: 'otro', label: 'Otro documento' }
    ]
  }
];

/** Etiquetas de tipos antiguos (envíos ya creados). */
const LEGACY_LABELS = {
  vrp_consentimiento: 'VRP – Consentimiento reconocimiento médico (legado)',
  vrp_renuncia: 'VRP – Renuncia reconocimiento médico (legado)'
};

const LABEL_BY_VALUE = {
  ...LEGACY_LABELS,
  ...Object.fromEntries(
    FIRMA_DOCUMENTO_GRUPOS.flatMap((g) => g.tipos.map((t) => [t.value, t.label]))
  )
};

/** Lista plana de tipos (selects de plantillas, etc.). */
export const FIRMA_DOCUMENTO_TIPOS = FIRMA_DOCUMENTO_GRUPOS.flatMap((g) => g.tipos);

/** Texto de ayuda en Kronos (generación automática desde Holded). */
export const FIRMA_DOC_PREP_HINTS = {
  riesgos_laborales:
    'Sin PDF: plantilla guardada o generación Holded (empresa, nombre, DNI, puesto).',
  riesgos_psicosociales:
    'Sin PDF: usa la plantilla del protocolo de riesgos psicosociales (no se genera desde Holded).',
  epis: 'Sin PDF: plantilla o generación Holded. Añade filas EPI abajo si generas.',
  acoso: 'Sin PDF: plantilla o generación Holded. Formación opcional en el portal.',
  vrp:
    'Un solo documento: en el portal el trabajador elige Sí (acepta VRP) o No (renuncia). Plantilla o generación Holded.',
  contrato:
    'Sube el PDF o usa la plantilla de contrato de esta empresa (si la hay). No se genera desde Holded.',
  baja:
    'Sin PDF: plantilla o generación Holded con fecha de efecto. PDF propio si viene de asesoría.'
};

export const FIRMA_DOCUMENTO_DEFAULT = 'contrato';

/** Tipos de pack en Kronos (contratación, baja o solo notificación). */
export const FIRMA_PACK_KINDS = [
  { id: 'contratacion', label: 'Contratación', shortLabel: 'Alta' },
  { id: 'baja', label: 'Baja / fin de relación', shortLabel: 'Baja' },
  { id: 'notificacion', label: 'Solo notificación', shortLabel: 'Notificación' }
];

/** Pack estándar de alta (sin contrato: añadirlo si aplica). */
export const FIRMA_DEFAULT_CONTRATACION_PACK = [
  'riesgos_laborales',
  'riesgos_psicosociales',
  'acoso',
  'epis',
  'vrp'
];

/** Pack estándar de baja: notificación + acuse en portal. */
export const FIRMA_DEFAULT_BAJA_PACK = ['baja'];

/** Pack genérico para aviso interno o comunicación sin fechas. */
export const FIRMA_DEFAULT_NOTIFICACION_PACK = ['otro'];

export function getFirmaDefaultPack(kind) {
  if (kind === 'baja') return [...FIRMA_DEFAULT_BAJA_PACK];
  if (kind === 'notificacion') return [...FIRMA_DEFAULT_NOTIFICACION_PACK];
  return [...FIRMA_DEFAULT_CONTRATACION_PACK];
}

export function getFirmaPackKindLabel(kind) {
  return FIRMA_PACK_KINDS.find((k) => k.id === kind)?.label || kind;
}

export function envioEsPackBaja(envio) {
  const docs = envio?.documentos || [];
  if (!docs.length) return false;
  return docs.some((d) => d.tipo_documento === 'baja');
}

export function getFirmaDocumentoLabel(value) {
  const v = String(value || '').trim();
  return LABEL_BY_VALUE[v] || v || '—';
}

export function getFirmaDocPrepHint(value) {
  return FIRMA_DOC_PREP_HINTS[String(value || '').trim()] || null;
}
