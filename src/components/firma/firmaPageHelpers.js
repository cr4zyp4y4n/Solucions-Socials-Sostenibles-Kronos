import { getFirmaDocumentoLabel } from '../../constants/firmaDocumentos';

export const initialEnvioForm = {
  nombre: 'Pack de contratación',
  fechaInicio: '',
  fechaFin: '',
  notasInternas: ''
};

export function newPackItem(tipoDocumento) {
  return {
    key: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    tipoDocumento,
    file: null,
    episRows: [{ equipo: '', marca: '', modelo: '' }]
  };
}

export function flowEstadoFirma(envio) {
  if (!envio) return { key: 'pendiente', label: 'Pendiente de envío' };
  if (envio.estado === 'cancelado') return { key: 'cancelado', label: 'Cancelado' };
  if (envio.estado === 'firmado' || envio.firmado_at) return { key: 'firmado', label: 'Firmado' };
  if (envio.otp_primera_solicitud_at) return { key: 'otp_enviado', label: 'SMS enviado' };
  if (envio.portal_abierto_at) return { key: 'portal_abierto', label: 'Enlace abierto' };
  const compartido = !!envio.link_compartido_at || envio.estado === 'enviado';
  if (compartido) return { key: 'link_enviado', label: 'Enlace enviado' };
  return { key: 'pendiente', label: 'Pendiente' };
}

export function estadoFlowColor(flowKey, colors) {
  switch (flowKey) {
    case 'firmado': return colors.success;
    case 'cancelado': return colors.error;
    case 'otp_enviado': return colors.info;
    case 'portal_abierto': return colors.info;
    case 'link_enviado': return colors.warning;
    case 'pendiente':
    default: return colors.textSecondary;
  }
}

export function formatFirmaDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' });
}

export function buildFirmaTimeline(envio) {
  if (!envio) return [];
  const numDocs = envio.documentos?.length || 1;
  const rows = [
    { key: 'creado', title: 'Envío creado en Kronos', at: envio.created_at || null },
    {
      key: 'compartido',
      title: 'Enlace compartido (WhatsApp, email, copiar…)',
      at: envio.link_compartido_at || null
    },
    { key: 'portal', title: 'Primera visita al portal', at: envio.portal_abierto_at || null },
    {
      key: 'otp',
      title: 'SMS con código OTP',
      at: envio.otp_primera_solicitud_at || null,
      note: 'Se registra al pulsar «Enviar código» en el portal.'
    },
    {
      key: 'firmado',
      title: numDocs > 1 ? `Pack firmado (${numDocs} documentos)` : 'Documento firmado',
      at: envio.firmado_at || null
    }
  ];
  if (envio.estado === 'cancelado') {
    rows.push({
      key: 'cancel',
      title: 'Envío cancelado',
      at: envio.updated_at || null,
      note: 'Última actualización del registro.'
    });
  }
  return rows.map((r) => ({
    ...r,
    display: r.at ? formatFirmaDate(r.at) : null
  }));
}

export function envioLabel(envio) {
  if (!envio) return '—';
  if (envio.nombre) return envio.nombre;
  const docs = envio.documentos || [];
  if (docs.length === 1) return getFirmaDocumentoLabel(docs[0]?.tipo_documento);
  return `Pack (${docs.length} documentos)`;
}

export function envioTieneDocumentosFirmados(envio) {
  if (!envio) return false;
  if (envio.firmado_at || envio.estado === 'firmado') return true;
  return (envio.documentos || []).some((d) => d.storage_path_firmado || d.firmado_at || d.estado === 'firmado');
}

export function documentosPackOrdenados(envio) {
  return [...(envio?.documentos || [])].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
}

export function filterEnvios(envios, { search = '', estadoFilter = 'todos' } = {}) {
  const q = String(search || '').trim().toLowerCase();
  return (envios || []).filter((envio) => {
    const flow = flowEstadoFirma(envio);
    if (estadoFilter === 'firmado' && flow.key !== 'firmado') return false;
    if (estadoFilter === 'cancelado' && flow.key !== 'cancelado') return false;
    if (estadoFilter === 'activo' && (flow.key === 'firmado' || flow.key === 'cancelado')) return false;
    if (!q) return true;
    const nombre = String(envio.trabajador?.nombre || '').toLowerCase();
    const dni = String(envio.trabajador?.dni || '').toLowerCase();
    const tel = String(envio.trabajador?.telefono || '').toLowerCase();
    const pack = envioLabel(envio).toLowerCase();
    return nombre.includes(q) || dni.includes(q) || tel.includes(q) || pack.includes(q);
  });
}

export async function writeClipboardSafely(text) {
  const s = String(text ?? '');
  if (!s) throw new Error('Vacío');
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(s);
      return;
    }
  } catch (_) {
    /* Electron fallback */
  }
  if (typeof window !== 'undefined' && window.electronAPI?.writeClipboardText) {
    await window.electronAPI.writeClipboardText(s);
    return;
  }
  throw new Error('clipboard');
}
