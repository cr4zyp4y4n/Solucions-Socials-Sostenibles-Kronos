import { getFirmaDocumentoLabel } from '../constants/firmaDocumentos';

const ACCION_LABELS = {
  envio_pack_creado: 'Pack creado en Kronos',
  link_compartido_desde_kronos: 'Enlace compartido desde Kronos',
  notificacion_canal: 'Notificación compartida (canal)',
  documento_lectura_confirmada: 'Declaración aceptada en portal',
  dni_confirmado: 'DNI confirmado en portal',
  dni_confirmacion_fallida: 'DNI incorrecto en portal',
  otp_solicitado: 'Código SMS solicitado',
  otp_verificado: 'Verificación código SMS',
  aceptado_y_firmado: 'Documento firmado electrónicamente',
  pack_aceptado_y_firmado: 'Pack firmado electrónicamente'
};

function formatFirmaDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'medium' });
}

function truncate(text, max = 120) {
  const s = String(text || '').trim();
  if (!s) return '';
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

/** Estado de aceptación por documento (para resumen en auditoría Kronos). */
export function describeDocumentoAceptacion(doc) {
  const tipo = getFirmaDocumentoLabel(doc?.tipo_documento);
  const op = doc?.opciones_aceptacion && typeof doc.opciones_aceptacion === 'object'
    ? doc.opciones_aceptacion
    : null;

  if (doc?.firmado_at) {
    return {
      tipo,
      estado: 'firmado',
      label: 'Aceptada y firmada',
      ok: true,
      declaracion: op?.declaracion || null,
      formacionAcoso: op?.formacion_acoso ? 'Sí' : null
    };
  }

  if (op?.lectura_confirmada === true) {
    return {
      tipo,
      estado: 'aceptada',
      label: 'Aceptada en portal: Sí',
      ok: true,
      declaracion: null,
      formacionAcoso: op.formacion_acoso ? 'Sí' : 'No'
    };
  }

  if (op?.lectura_confirmada === false) {
    return {
      tipo,
      estado: 'rechazada',
      label: 'Aceptada en portal: No',
      ok: false,
      declaracion: null,
      formacionAcoso: null
    };
  }

  if (doc?.revisado_at) {
    return {
      tipo,
      estado: 'revisado_sin_detalle',
      label: 'Lectura confirmada (sin detalle de declaración)',
      ok: true,
      declaracion: null,
      formacionAcoso: null
    };
  }

  return {
    tipo,
    estado: 'pendiente',
    label: 'Pendiente — no aceptada',
    ok: false,
    declaracion: null,
    formacionAcoso: null
  };
}

export function describeFirmaAuditoriaRow(row) {
  const det = row?.detalle && typeof row.detalle === 'object' ? row.detalle : {};
  const accion = String(det.accion || '').trim();
  let title = ACCION_LABELS[accion] || accion || 'Evento de firma';

  if (accion === 'otp_verificado') {
    title = det.ok ? 'Código SMS correcto' : 'Código SMS incorrecto';
  }

  const notes = [];

  if (accion === 'documento_lectura_confirmada') {
    if (det.tipo_label || det.tipo_documento) {
      notes.push(det.tipo_label || det.tipo_documento);
    }
    if (det.aceptacion_si) notes.push(det.aceptacion_si);
    else if (det.lectura_confirmada) notes.push('Aceptada: Sí');
    if (det.declaracion) notes.push(truncate(det.declaracion, 140));
    if (det.formacion_acoso) notes.push('Formación acoso solicitada: Sí');
    if (det.opciones_guardadas === false) {
      notes.push('Aviso: declaración no persistida en BD (falta migración opciones_aceptacion)');
    }
  }

  if (accion === 'notificacion_canal') {
    if (det.canal) notes.push(`Canal: ${det.canal}`);
    if (det.primera_vez === false) notes.push('Reenvío');
  }

  if (accion === 'otp_solicitado' && det.delivery) {
    notes.push(`Canal: ${det.delivery}`);
  }
  if (accion === 'dni_confirmado' && det.dni_hash) {
    notes.push(`Huella DNI (hash): ${String(det.dni_hash).slice(0, 12)}…`);
  }
  if (accion === 'pack_aceptado_y_firmado' || accion === 'aceptado_y_firmado') {
    if (det.trabajador) notes.push(det.trabajador);
    if (det.dni) notes.push(`DNI ${det.dni}`);
    if (det.dni_confirmado_portal) notes.push('DNI confirmado en portal');
    if (det.sms_verificado_at) notes.push(`SMS verificado: ${formatFirmaDateTime(det.sms_verificado_at)}`);
    if (det.num_documentos) notes.push(`${det.num_documentos} documento(s)`);
    if (Array.isArray(det.declaraciones_aceptadas) && det.declaraciones_aceptadas.length) {
      for (const d of det.declaraciones_aceptadas) {
        const lbl = d.tipo_documento ? getFirmaDocumentoLabel(d.tipo_documento) : 'Documento';
        notes.push(`${lbl}: aceptada`);
      }
    }
  }
  if (accion === 'envio_pack_creado' && det.num_documentos) {
    notes.push(`${det.num_documentos} documento(s) en el pack`);
  }

  const ua = row?.user_agent ? String(row.user_agent) : '';
  const uaShort = ua ? `${ua.slice(0, 48)}${ua.length > 48 ? '…' : ''}` : '';

  return {
    id: row.id,
    at: formatFirmaDateTime(row.created_at),
    title,
    resultado: row.resultado || '—',
    ok: String(row.resultado || '').toLowerCase() === 'ok',
    ip: row.ip || '',
    note: notes.join(' · '),
    userAgent: uaShort
  };
}
