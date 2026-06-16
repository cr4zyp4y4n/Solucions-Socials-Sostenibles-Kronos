const ACCION_LABELS = {
  envio_pack_creado: 'Pack creado en Kronos',
  link_compartido_desde_kronos: 'Enlace compartido desde Kronos',
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

export function describeFirmaAuditoriaRow(row) {
  const det = row?.detalle && typeof row.detalle === 'object' ? row.detalle : {};
  const accion = String(det.accion || '').trim();
  let title = ACCION_LABELS[accion] || accion || 'Evento de firma';

  if (accion === 'otp_verificado') {
    title = det.ok ? 'Código SMS correcto' : 'Código SMS incorrecto';
  }

  const notes = [];
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
