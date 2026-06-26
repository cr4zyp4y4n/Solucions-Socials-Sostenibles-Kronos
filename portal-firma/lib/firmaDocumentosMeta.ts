/** Metadatos por tipo (sincronizar claves con Kronos `src/constants/firmaDocumentos.js`). */

export type DocOpciones = {
  lectura_confirmada?: boolean;
  formacion_acoso?: boolean;
};

export type FirmaDocMeta = {
  readStatement: string;
  stampDeclaration: string;
  optionalFormacionAcoso?: boolean;
  prepHint?: string;
};

const META: Record<string, FirmaDocMeta> = {
  contrato: {
    readStatement:
      'He leído el contrato de trabajo y acepto su contenido, firmando electrónicamente mediante el procedimiento verificado por SMS.',
    stampDeclaration: 'Aceptación del contrato de trabajo',
    prepHint: 'PDF con datos del trabajador y la empresa cumplimentados.'
  },
  riesgos_laborales: {
    readStatement:
      'He recibido la información sobre los riesgos específicos de mi puesto (ficha RPT) y me comprometo a conocerla y aplicarla (art. 18 Ley 31/1995 PRL).',
    stampDeclaration: 'Acuse de recibo información RPT (art. 18 LPRL)',
    prepHint: 'Cumplimentar EMPRESA, nombre, DNI y fecha antes de subir.'
  },
  epis: {
    readStatement:
      'Confirmo haber recibido los equipos de protección individual indicados en este documento, así como la información e instrucciones para su uso correcto.',
    stampDeclaration: 'Recibo e información EPIS',
    prepHint: 'Rellenar la tabla de EPIs (equipo, marca, modelo) para este trabajador.'
  },
  acoso: {
    readStatement:
      'He recibido el procedimiento de actuación ante riesgos psicosociales derivados de comportamientos inadecuados (acoso) y me comprometo a conocerlo y aplicarlo (art. 18 LPRL).',
    stampDeclaration: 'Acuse de recibo protocolo acoso (art. 18 LPRL)',
    optionalFormacionAcoso: true,
    prepHint: 'Cumplimentar EMPRESA, nombre y DNI. La solicitud de formación se registra en el portal.'
  },
  vrp_consentimiento: {
    readStatement:
      'Presto mi consentimiento expreso para la realización del reconocimiento médico / vigilancia de la salud que la empresa pone a mi disposición (art. 22 LPRL).',
    stampDeclaration: 'Consentimiento reconocimiento médico (art. 22 LPRL)',
    prepHint: 'Usar solo si el trabajador desea el VRP. Si renuncia, sustituir por el documento de renuncia.'
  },
  vrp_renuncia: {
    readStatement:
      'Dejo constancia expresa de mi renuncia personal a la realización del reconocimiento médico / vigilancia de la salud (art. 22 LPRL).',
    stampDeclaration: 'Renuncia reconocimiento médico (art. 22 LPRL)',
    prepHint: 'Usar solo si el trabajador NO desea el VRP. No incluir ambos VRP en el mismo pack.'
  },
  pdp: {
    readStatement: 'He leído la información sobre protección de datos (RGPD) y quedo informado/a.',
    stampDeclaration: 'Acuse de recibo información RGPD'
  },
  confidencialidad: {
    readStatement: 'Acepto el compromiso de confidencialidad en los términos indicados en este documento.',
    stampDeclaration: 'Aceptación compromiso de confidencialidad'
  },
  registro_horario: {
    readStatement: 'He recibido información sobre el registro de jornada.',
    stampDeclaration: 'Acuse de recibo registro horario'
  },
  normas_internas: {
    readStatement: 'He recibido las normas internas / manual del empleado y me comprometo a cumplirlas.',
    stampDeclaration: 'Acuse de recibo normas internas'
  },
  igualdad: {
    readStatement: 'He leído la política de igualdad de la empresa.',
    stampDeclaration: 'Acuse de recibo política de igualdad'
  },
  anexo: {
    readStatement: 'He leído el anexo contractual y acepto su contenido.',
    stampDeclaration: 'Aceptación anexo contractual'
  },
  oferta_empleo: {
    readStatement: 'He leído la oferta / propuesta de empleo y acepto su contenido.',
    stampDeclaration: 'Aceptación oferta de empleo'
  },
  formacion_prl: {
    readStatement: 'He recibido la información / formación en materia de PRL indicada en este documento.',
    stampDeclaration: 'Acuse de recibo formación PRL'
  },
  baja: {
    readStatement:
      'He recibido la notificación de fin de relación laboral, he leído su contenido y doy acuse de recibo mediante este procedimiento verificado por SMS.',
    stampDeclaration: 'Acuse de recibo — fin de relación laboral'
  },
  otro: {
    readStatement: 'He leído el documento y acepto su contenido.',
    stampDeclaration: 'Aceptación electrónica del documento'
  }
};

const DEFAULT_META: FirmaDocMeta = {
  readStatement: 'He leído el documento y confirmo su contenido.',
  stampDeclaration: 'Aceptación electrónica del documento'
};

export function getFirmaDocMeta(tipo?: string | null): FirmaDocMeta {
  const key = String(tipo || '').trim();
  return META[key] || DEFAULT_META;
}

export function buildStampLinesForDoc({
  trabajadorNombre,
  trabajadorDni,
  tipoDocumento,
  opciones,
  nowIso,
  documentoId,
  tokenRowId,
  hashPdf,
  ip,
  userAgent,
  dniConfirmadoEnPortal,
  smsVerificado,
  smsVerificadoAt
}: {
  trabajadorNombre?: string | null;
  trabajadorDni?: string | null;
  tipoDocumento: string;
  opciones?: DocOpciones | null;
  nowIso: string;
  documentoId: string;
  tokenRowId: string;
  hashPdf?: string | null;
  ip?: string;
  userAgent?: string;
  dniConfirmadoEnPortal?: boolean;
  smsVerificado?: boolean;
  smsVerificadoAt?: string | null;
}) {
  const meta = getFirmaDocMeta(tipoDocumento);
  const uaShort = userAgent ? `${userAgent.slice(0, 40)}${userAgent.length > 40 ? '…' : ''}` : '';
  const smsLine = smsVerificadoAt
    ? `Verificación SMS (OTP): completada · ${new Date(smsVerificadoAt).toLocaleString('es-ES')}`
    : smsVerificado
      ? 'Verificación SMS (OTP): completada'
      : '';
  const lines = [
    meta.stampDeclaration,
    trabajadorNombre ? `Trabajador: ${trabajadorNombre}` : '',
    trabajadorDni ? `DNI: ${trabajadorDni}` : '',
    dniConfirmadoEnPortal ? 'DNI confirmado en portal antes del SMS: Sí' : '',
    smsLine,
    `Fecha/hora firma: ${new Date(nowIso).toLocaleString('es-ES')}`,
    hashPdf ? `SHA-256 (orig): ${String(hashPdf).slice(0, 16)}…` : '',
    ip ? `IP: ${ip}` : '',
    uaShort ? `UA: ${uaShort}` : ''
  ].filter(Boolean);

  if (tipoDocumento === 'acoso' && opciones?.formacion_acoso) {
    lines.splice(3, 0, 'Solicita formación PREVENCION DEL ACOSO: Sí');
  }

  return lines;
}
