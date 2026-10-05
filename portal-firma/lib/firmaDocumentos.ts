/** Etiquetas de tipo de documento (mismas claves que Kronos `src/constants/firmaDocumentos.js`). */
const LABEL_BY_VALUE: Record<string, string> = {
  contrato: 'Contrato de trabajo',
  anexo: 'Anexo contractual',
  oferta_empleo: 'Oferta / propuesta de empleo',
  riesgos_laborales: 'Información RPT – riesgos del puesto',
  riesgos_psicosociales: 'Protocolo de riesgos psicosociales',
  epis: 'Entrega e información de EPIS',
  vrp: 'Aceptación o renuncia del reconocimiento médico (VRP)',
  vrp_consentimiento: 'VRP – Consentimiento reconocimiento médico (legado)',
  vrp_renuncia: 'VRP – Renuncia reconocimiento médico (legado)',
  formacion_prl: 'Formación / información PRL',
  acoso: 'Protocolo de prevención del acoso',
  protocol_citas_medicas: 'Protocolo de citas médicas',
  protocol_absencies: 'Protocolo de ausencias',
  pdp: 'Protección de datos (RGPD)',
  confidencialidad: 'Compromiso de confidencialidad',
  registro_horario: 'Información registro horario',
  normas_internas: 'Normas internas / manual empleado',
  igualdad: 'Política de igualdad',
  baja: 'Baja / fin de relación laboral',
  otro: 'Otro documento'
};

export function getFirmaDocumentoLabel(value?: string | null) {
  const v = String(value || '').trim();
  return LABEL_BY_VALUE[v] || v || '—';
}

