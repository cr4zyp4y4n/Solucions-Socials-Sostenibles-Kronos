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

      { value: 'epis', label: 'Entrega e información de EPIS' },

      { value: 'vrp_consentimiento', label: 'VRP – Consentimiento reconocimiento médico' },

      { value: 'vrp_renuncia', label: 'VRP – Renuncia reconocimiento médico' },

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



const LABEL_BY_VALUE = Object.fromEntries(

  FIRMA_DOCUMENTO_GRUPOS.flatMap((g) => g.tipos.map((t) => [t.value, t.label]))

);



/** Texto de ayuda en Kronos (generación automática desde Holded). */

export const FIRMA_DOC_PREP_HINTS = {

  riesgos_laborales: 'Se genera solo con datos Holded (empresa, nombre, DNI, puesto).',

  epis: 'Se genera desde Holded. Añade filas de EPI abajo o deja vacío si no aplica.',

  acoso: 'Se genera desde Holded. La formación opcional se marca en el portal.',

  vrp_consentimiento: 'Solo si desea el VRP. Cambia a «Renuncia» si no lo quiere (nunca ambos).',

  vrp_renuncia: 'Solo si renuncia al VRP. No incluir junto al de consentimiento.',

  contrato: 'Sube el contrato PDF propio; no se genera automáticamente.'

};



export const FIRMA_DOCUMENTO_DEFAULT = 'contrato';



/** Pack estándar de alta (sin contrato: añadirlo si aplica). */

export const FIRMA_DEFAULT_CONTRATACION_PACK = [

  'riesgos_laborales',

  'acoso',

  'epis',

  'vrp_consentimiento'

];



export function getFirmaDocumentoLabel(value) {

  const v = String(value || '').trim();

  return LABEL_BY_VALUE[v] || v || '—';

}



export function getFirmaDocPrepHint(value) {

  return FIRMA_DOC_PREP_HINTS[String(value || '').trim()] || null;

}


