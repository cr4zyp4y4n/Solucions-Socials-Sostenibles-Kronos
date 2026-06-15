import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle, Clock, Copy, Download, Eye, FileText, Link2, Phone, Plus, RefreshCw, Send, Upload, Users, X, XCircle } from 'feather-icons-react';
import { useTheme } from './ThemeContext';
import firmaService from '../services/firmaService';
import holdedEmployeesService from '../services/holdedEmployeesService';
import {
  FIRMA_DEFAULT_CONTRATACION_PACK,
  FIRMA_DOCUMENTO_DEFAULT,
  FIRMA_DOCUMENTO_GRUPOS,
  getFirmaDocPrepHint,
  getFirmaDocumentoLabel
} from '../constants/firmaDocumentos';
import { getFirmaEmpresaNombre } from '../constants/firmaEmpresas';
import { generateFirmaPdfFile } from '../utils/firmaPdfGenerator';
import { describeFirmaAuditoriaRow } from '../utils/firmaAuditoriaLabels';
import SectionHeader from './SectionHeader';

const initialEnvioForm = {
  nombre: 'Pack de contratación',
  fechaInicio: '',
  fechaFin: '',
  notasInternas: ''
};

function newPackItem(tipoDocumento = FIRMA_DOCUMENTO_DEFAULT) {
  return {
    key: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    tipoDocumento,
    file: null,
    episRows: [{ equipo: '', marca: '', modelo: '' }]
  };
}

/** Etiqueta de seguimiento: envío → apertura del portal → firma (no sustituye el campo `estado` en BD). */
function flowEstadoFirma(envio) {
  if (!envio) return { key: 'pendiente', label: 'Pendiente de envío' };
  if (envio.estado === 'cancelado') return { key: 'cancelado', label: 'Cancelado' };
  if (envio.estado === 'firmado' || envio.firmado_at) return { key: 'firmado', label: 'Firmado' };
  if (envio.otp_primera_solicitud_at) return { key: 'otp_enviado', label: 'SMS OTP enviado' };
  if (envio.portal_abierto_at) return { key: 'portal_abierto', label: 'Enlace abierto' };
  const compartido = !!envio.link_compartido_at || envio.estado === 'enviado';
  if (compartido) return { key: 'link_enviado', label: 'Enlace enviado' };
  return { key: 'pendiente', label: 'Pendiente de envío' };
}

const estadoFlowColor = (flowKey, colors) => {
  switch (flowKey) {
    case 'firmado': return colors.success;
    case 'cancelado': return colors.error;
    case 'otp_enviado': return colors.info;
    case 'portal_abierto': return colors.info;
    case 'link_enviado': return colors.warning;
    case 'pendiente':
    default: return colors.textSecondary;
  }
};

function flowEstadoIcon(flowKey) {
  if (flowKey === 'firmado') return CheckCircle;
  if (flowKey === 'cancelado') return XCircle;
  if (flowKey === 'otp_enviado') return Send;
  if (flowKey === 'portal_abierto') return Eye;
  return FileText;
}

function formatFirmaDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' });
}

/** Pasos ordenados para el modal de seguimiento (fechas que tenemos en BD). */
function buildFirmaTimeline(envio) {
  if (!envio) return [];
  const numDocs = envio.documentos?.length || 1;
  const rows = [
    { key: 'creado', title: 'Envío creado en Kronos', at: envio.created_at || null },
    {
      key: 'compartido',
      title: 'Enlace compartido (WhatsApp, email, copiar enlace…)',
      at: envio.link_compartido_at || null
    },
    { key: 'portal', title: 'Primera visita al portal de firma', at: envio.portal_abierto_at || null },
    {
      key: 'otp',
      title: 'SMS con código OTP (desde el portal)',
      at: envio.otp_primera_solicitud_at || null,
      note: 'Se registra al pulsar «Enviar código» en el portal; en desarrollo sin Twilio puede ser modo debug sin SMS real.'
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
      note: 'Fecha aproximada (última actualización del registro).'
    });
  }
  return rows.map((r) => ({
    ...r,
    display: r.at ? formatFirmaDate(r.at) : null
  }));
}

function envioLabel(envio) {
  if (!envio) return '—';
  if (envio.nombre) return envio.nombre;
  const docs = envio.documentos || [];
  if (docs.length === 1) return getFirmaDocumentoLabel(docs[0]?.tipo_documento);
  return `Pack (${docs.length} documentos)`;
}

function envioTieneDocumentosFirmados(envio) {
  if (!envio) return false;
  if (envio.firmado_at || envio.estado === 'firmado') return true;
  return (envio.documentos || []).some((d) => d.storage_path_firmado || d.firmado_at || d.estado === 'firmado');
}

function documentosPackOrdenados(envio) {
  return [...(envio?.documentos || [])].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
}

async function writeClipboardSafely(text) {
  const s = String(text ?? '');
  if (!s) throw new Error('Vacío');
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(s);
      return;
    }
  } catch (_) {
    /* seguir: en Electron navigator.clipboard a veces falla */
  }
  if (typeof window !== 'undefined' && window.electronAPI?.writeClipboardText) {
    await window.electronAPI.writeClipboardText(s);
    return;
  }
  throw new Error('clipboard');
}

export default function FirmaPage() {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [savingDocumento, setSavingDocumento] = useState(false);
  const [trabajadores, setTrabajadores] = useState([]);
  const [envios, setEnvios] = useState([]);
  const [envioForm, setEnvioForm] = useState(initialEnvioForm);
  const [packItems, setPackItems] = useState(() =>
    FIRMA_DEFAULT_CONTRATACION_PACK.map((tipo) => newPackItem(tipo))
  );
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [selectedEntity, setSelectedEntity] = useState('EI_SSS');
  const [holdedEmployees, setHoldedEmployees] = useState([]);
  const [holdedLoading, setHoldedLoading] = useState(false);
  const [holdedError, setHoldedError] = useState('');
  const [holdedSearch, setHoldedSearch] = useState('');
  const [selectedHoldedId, setSelectedHoldedId] = useState('');
  const [firmaTimelineDoc, setFirmaTimelineDoc] = useState(null);
  const [firmaDocsEnvio, setFirmaDocsEnvio] = useState(null);
  const [firmaDocsLoadingId, setFirmaDocsLoadingId] = useState('');
  const [firmaAuditoriaEnvio, setFirmaAuditoriaEnvio] = useState(null);
  const [firmaAuditoriaRows, setFirmaAuditoriaRows] = useState([]);
  const [firmaAuditoriaLoading, setFirmaAuditoriaLoading] = useState(false);
  const [firmaPortalBaseUrl, setFirmaPortalBaseUrl] = useState('');

  const selectedHoldedEmployee = useMemo(
    () => holdedEmployees.find((e) => String(e.id) === String(selectedHoldedId)) || null,
    [holdedEmployees, selectedHoldedId]
  );

  const entityToCompany = useMemo(() => ({
    EI_SSS: 'solucions',
    MENJAR_DHORT: 'menjar'
  }), []);

  const loadPortalUrl = useCallback(async () => {
    try {
      const b = await firmaService.resolvePortalBaseUrl();
      setFirmaPortalBaseUrl(b || '');
    } catch {
      setFirmaPortalBaseUrl('');
    }
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [trabajadoresData, enviosData] = await Promise.all([
        firmaService.loadTrabajadores(),
        firmaService.loadEnvios()
      ]);
      setTrabajadores(trabajadoresData);
      setEnvios(enviosData);
    } catch (e) {
      setError(e?.message || 'Error cargando datos de Firma.');
    } finally {
      setLoading(false);
    }
  }, []);

  const marcarEnlaceCompartido = useCallback(
    async (envio) => {
      if (!envio?.id) return;
      try {
        await firmaService.marcarLinkCompartidoEnvio(envio, {
          esLegacySuelto: !!envio.es_legacy_suelto
        });
      } catch (e) {
        console.warn('marcarLinkCompartidoEnvio:', e?.message || e);
      } finally {
        await loadAll();
      }
    },
    [loadAll]
  );

  useEffect(() => {
    loadPortalUrl();
    loadAll();
  }, [loadAll, loadPortalUrl]);

  useEffect(() => {
    if (!firmaTimelineDoc) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setFirmaTimelineDoc(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [firmaTimelineDoc]);

  useEffect(() => {
    if (!firmaDocsEnvio) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setFirmaDocsEnvio(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [firmaDocsEnvio]);

  useEffect(() => {
    if (!firmaAuditoriaEnvio) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setFirmaAuditoriaEnvio(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [firmaAuditoriaEnvio]);

  const loadHoldedEmployees = useCallback(async () => {
    setHoldedLoading(true);
    setHoldedError('');
    try {
      const company = entityToCompany[selectedEntity] || 'solucions';
      const list = await holdedEmployeesService.getEmployeesTransformed(company);
      setHoldedEmployees(Array.isArray(list) ? list : []);
    } catch (e) {
      setHoldedEmployees([]);
      setHoldedError(e?.message || 'Error cargando empleados desde Holded.');
    } finally {
      setHoldedLoading(false);
    }
  }, [entityToCompany, selectedEntity]);

  useEffect(() => {
    loadHoldedEmployees();
  }, [loadHoldedEmployees]);

  const saveEnvio = async () => {
    if (!selectedHoldedEmployee) {
      setError('Selecciona un empleado de Holded.');
      return;
    }
    if (!packItems.length) {
      setError('Añade al menos un documento al pack.');
      return;
    }
    const contratoSinPdf = packItems.find((i) => i.tipoDocumento === 'contrato' && !i.file);
    if (contratoSinPdf) {
      setError('El contrato laboral requiere subir el PDF (no se genera automáticamente).');
      return;
    }
    setSavingDocumento(true);
    setError('');
    setMessage('');
    try {
      const items = await Promise.all(
        packItems.map(async (item) => {
          let file = item.file;
          if (!file) {
            file = await generateFirmaPdfFile({
              tipoDocumento: item.tipoDocumento,
              employee: selectedHoldedEmployee,
              entityKey: selectedEntity,
              episRows: item.episRows || []
            });
          }
          return { tipoDocumento: item.tipoDocumento, file };
        })
      );
      const trabajador = await firmaService.getOrCreateTrabajadorFromHolded(selectedHoldedEmployee);
      const result = await firmaService.createEnvio({
        trabajadorId: trabajador.id,
        nombre: envioForm.nombre,
        fechaInicio: envioForm.fechaInicio,
        fechaFin: envioForm.fechaFin,
        notasInternas: envioForm.notasInternas,
        items
      });
      await loadAll();
      setEnvioForm(initialEnvioForm);
      setPackItems(FIRMA_DEFAULT_CONTRATACION_PACK.map((tipo) => newPackItem(tipo)));
      setSelectedHoldedId('');
      const n = items.length;
      setMessage(
        `Pack creado (${n} documento${n > 1 ? 's' : ''}). Un solo enlace: ${result.tokenInfo.portalLink}`
      );
    } catch (e) {
      setError(e?.message || 'Error creando envío de firma.');
    } finally {
      setSavingDocumento(false);
    }
  };

  const copyLink = async (doc) => {
    const link = String(doc?.portal_link || '').trim();
    if (!link) {
      setError('No hay enlace de portal para copiar.');
      return;
    }
    try {
      await writeClipboardSafely(link);
      setMessage('Enlace copiado al portapapeles.');
      setError('');
      await marcarEnlaceCompartido(doc);
    } catch (_) {
      setError('No se ha podido copiar al portapapeles. Si persiste, reinicia Kronos y vuelve a intentar.');
    }
  };

  const buildShareText = (envio) => {
    const trabajador = String(envio?.trabajador?.nombre || '').trim();
    const label = envioLabel(envio);
    const prefix = trabajador
      ? `Kronos: ${trabajador}. ${label} pendiente de firma.`
      : `Kronos: ${label} pendiente de firma.`;
    const link = String(envio?.portal_link || '').trim();
    return link ? `${prefix} Enlace: ${link}` : prefix;
  };

  const copyShareText = async (doc) => {
    const text = buildShareText(doc);
    try {
      await writeClipboardSafely(text);
      setMessage('Mensaje copiado al portapapeles.');
      setError('');
      await marcarEnlaceCompartido(doc);
    } catch (_) {
      setError('No se ha podido copiar el mensaje al portapapeles.');
    }
  };

  function normalizeEmail(email) {
    const e = String(email || '').trim();
    if (!e) return '';
    return e;
  }

  function normalizeWhatsAppPhone(phone) {
    const raw = String(phone || '').trim();
    if (!raw) return '';
    const digits = raw.replace(/[^\d+]/g, '');
    const noPlus = digits.startsWith('+') ? digits.slice(1) : digits;
    // si viene como 9 dígitos español, asumimos +34
    if (/^\d{9}$/.test(noPlus)) return `34${noPlus}`;
    return noPlus;
  }

  const openLink = async (url) => {
    if (!url) return;
    try {
      if (window.electronAPI?.openExternal) {
        await window.electronAPI.openExternal(url);
        return;
      }
    } catch (e) {
      console.warn('No se pudo abrir en navegador externo:', e);
    }
    window.open(url, '_blank', 'noreferrer');
  };

  const verDocumentoPdf = async (documento, { firmado = true } = {}) => {
    const key = `${documento.id}:${firmado ? 'firmado' : 'original'}`;
    setFirmaDocsLoadingId(key);
    setError('');
    try {
      const url = await firmaService.getDocumentoPdfSignedUrl(documento, { firmado });
      await openLink(url);
    } catch (e) {
      setError(e?.message || 'No se pudo abrir el PDF.');
    } finally {
      setFirmaDocsLoadingId('');
    }
  };

  const descargarDocumentoPdf = async (documento, { firmado = true } = {}) => {
    const key = `${documento.id}:dl:${firmado ? 'firmado' : 'original'}`;
    setFirmaDocsLoadingId(key);
    setError('');
    try {
      await firmaService.downloadDocumentoPdf(documento, { firmado });
    } catch (e) {
      setError(e?.message || 'No se pudo descargar el PDF.');
    } finally {
      setFirmaDocsLoadingId('');
    }
  };

  const openFirmaAuditoria = async (envio) => {
    setFirmaAuditoriaEnvio(envio);
    setFirmaAuditoriaRows([]);
    setFirmaAuditoriaLoading(true);
    setError('');
    try {
      const rows = await firmaService.loadAuditoriasForEnvio(envio);
      setFirmaAuditoriaRows(rows);
    } catch (e) {
      setError(e?.message || 'No se pudo cargar la auditoría del envío.');
      setFirmaAuditoriaEnvio(null);
    } finally {
      setFirmaAuditoriaLoading(false);
    }
  };

  const openWhatsApp = async (doc) => {
    if (!doc?.portal_link) {
      setError('No hay enlace de portal para compartir.');
      return;
    }
    const to = normalizeWhatsAppPhone(doc.trabajador?.telefono || '');
    if (!to) {
      setError('El trabajador no tiene teléfono móvil para WhatsApp.');
      return;
    }
    const text = buildShareText(doc);
    const encoded = encodeURIComponent(text);
    const url = `https://wa.me/${to}?text=${encoded}`;
    await openLink(url);
    await marcarEnlaceCompartido(doc);
  };

  const openEmail = async (doc) => {
    if (!doc?.portal_link) {
      setError('No hay enlace de portal para compartir.');
      return;
    }
    const to = normalizeEmail(doc.trabajador?.email || '');
    if (!to) {
      setError('El trabajador no tiene email.');
      return;
    }
    const subject = 'Documento pendiente de firma (Kronos)';
    const body = buildShareText(doc);
    const url = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    await openLink(url);
    await marcarEnlaceCompartido(doc);
  };

  const cancelEnvio = async (envio) => {
    if (!window.confirm('¿Seguro que quieres cancelar este envío de firma?')) return;
    try {
      await firmaService.cancelarEnvio(envio.id, { esLegacySuelto: !!envio.es_legacy_suelto });
      await loadAll();
      setMessage('Envío cancelado correctamente.');
      setError('');
    } catch (e) {
      setError(e?.message || 'No se ha podido cancelar el envío.');
    }
  };

  return (
    <div style={{ padding: 24, color: colors.text }}>
      <SectionHeader
        icon={FileText}
        title="Firma"
        subtitle="Pack de contratación: los PDF se generan desde Holded. Un enlace; el trabajador revisa y firma todo."
        actions={(
          <button
            onClick={loadAll}
            disabled={loading}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.surface, color: colors.text, cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 800, opacity: loading ? 0.6 : 1 }}
          >
            <RefreshCw size={16} />
            Refrescar
          </button>
        )}
      />

      {message ? (
        <div style={{ marginBottom: 12, padding: 12, borderRadius: 12, background: `${colors.success}1A`, border: `1px solid ${colors.success}55`, color: colors.text }}>
          {message}
        </div>
      ) : null}
      {error ? (
        <div style={{ marginBottom: 12, padding: 12, borderRadius: 12, background: `${colors.error}12`, border: `1px solid ${colors.error}55`, color: colors.text }}>
          {error}
        </div>
      ) : null}
      {!firmaPortalBaseUrl ? (
        <div
          style={{
            marginBottom: 12,
            padding: 14,
            borderRadius: 12,
            background: `${colors.warning}14`,
            border: `1px solid ${colors.warning}66`,
            color: colors.text,
            fontSize: 13,
            lineHeight: 1.45
          }}
        >
          <strong>Falta la URL del portal de firma.</strong> En el archivo <code style={{ background: colors.background, padding: '2px 6px', borderRadius: 6 }}>.env</code> de Kronos (misma carpeta que usa el ejecutable / el proyecto) añade por ejemplo:
          <div style={{ marginTop: 8, fontFamily: 'ui-monospace, monospace', fontSize: 12, wordBreak: 'break-all' }}>
            FIRMA_PORTAL_BASE_URL=https://firma.solucionssocials.org/firmar
          </div>
          <div style={{ marginTop: 8, color: colors.textSecondary, fontSize: 12 }}>
            Debe ser la base pública donde está desplegado Next (ruta <code style={{ background: colors.background, padding: '2px 6px', borderRadius: 6 }}>/firmar</code> sin token). Guarda el .env y <strong>reinicia Kronos</strong>. Opcional: en el navegador puedes fijar la misma URL en localStorage <code style={{ background: colors.background, padding: '2px 6px', borderRadius: 6 }}>FIRMA_PORTAL_BASE_URL</code> para pruebas.
          </div>
        </div>
      ) : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 420px) minmax(420px, 1fr)', gap: 18, alignItems: 'start' }}>
        <div style={{ display: 'grid', gap: 18 }}>
          <div style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 14, padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <Users size={18} color={colors.primary} />
              <div style={{ fontSize: 18, fontWeight: 800 }}>Trabajador (Holded)</div>
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <select
                  value={selectedEntity}
                  onChange={(e) => setSelectedEntity(e.target.value)}
                  style={{ padding: 10, borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.background, color: colors.text, fontWeight: 800 }}
                >
                  <option value="EI_SSS">EI_SSS</option>
                  <option value="MENJAR_DHORT">MENJAR_DHORT</option>
                </select>
                <button
                  onClick={loadHoldedEmployees}
                  disabled={holdedLoading}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.surface, color: colors.text, cursor: holdedLoading ? 'not-allowed' : 'pointer', fontWeight: 800 }}
                >
                  <RefreshCw size={16} />
                  {holdedLoading ? 'Cargando…' : 'Recargar'}
                </button>
              </div>

              <div>
                <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6, fontWeight: 700 }}>Buscar</div>
                <input
                  value={holdedSearch}
                  onChange={(e) => setHoldedSearch(e.target.value)}
                  placeholder={holdedLoading ? 'Cargando empleados…' : 'Buscar por nombre/DNI/email/teléfono…'}
                  style={{ width: '100%', padding: 10, borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.background, color: colors.text, boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6, fontWeight: 700 }}>Empleado</div>
                <select
                  value={selectedHoldedId}
                  onChange={(e) => setSelectedHoldedId(e.target.value)}
                  style={{ width: '100%', padding: 10, borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.background, color: colors.text, boxSizing: 'border-box' }}
                >
                  <option value="">{holdedLoading ? 'Cargando…' : 'Selecciona un empleado'}</option>
                  {holdedEmployeesService.searchEmployees(holdedEmployees, holdedSearch)
                    .slice(0, 200)
                    .map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.nombreCompleto} {emp.dni ? `· ${emp.dni}` : ''} {emp.telefono ? `· ${emp.telefono}` : ''}
                      </option>
                    ))}
                </select>
                {holdedError ? (
                  <div style={{ marginTop: 8, fontSize: 12, color: colors.error, fontWeight: 700 }}>{holdedError}</div>
                ) : null}
              </div>

              {selectedHoldedEmployee ? (
                <div style={{ padding: 12, borderRadius: 12, border: `1px solid ${colors.border}`, background: colors.background }}>
                  <div style={{ fontWeight: 900 }}>{selectedHoldedEmployee.nombreCompleto}</div>
                  <div style={{ fontSize: 12, color: colors.textSecondary }}>
                    {selectedHoldedEmployee.email || '—'} · {selectedHoldedEmployee.telefono || '—'}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 14, padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <FileText size={18} color={colors.primary} />
              <div style={{ fontSize: 18, fontWeight: 800 }}>Nuevo pack de contratación</div>
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              <div>
                <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6, fontWeight: 700 }}>Empleado seleccionado</div>
                <div style={{ padding: 10, borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.background, color: colors.text }}>
                  {selectedHoldedEmployee ? (
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 900 }}>{selectedHoldedEmployee.nombreCompleto}</div>
                        <div style={{ fontSize: 12, color: colors.textSecondary }}>
                          {selectedHoldedEmployee.email || '—'} · {selectedHoldedEmployee.telefono || '—'}
                        </div>
                      </div>
                      <button
                        onClick={() => setSelectedHoldedId('')}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 10px', borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.surface, color: colors.text, cursor: 'pointer', fontWeight: 800 }}
                      >
                        <XCircle size={14} />
                        Cambiar
                      </button>
                    </div>
                  ) : (
                    <span style={{ color: colors.textSecondary }}>Selecciona un empleado en el panel de arriba.</span>
                  )}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6, fontWeight: 700 }}>Nombre del pack</div>
                <input
                  value={envioForm.nombre}
                  onChange={(e) => setEnvioForm((p) => ({ ...p, nombre: e.target.value }))}
                  placeholder="Pack de contratación"
                  style={{ width: '100%', padding: 10, borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.background, color: colors.text, boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ fontSize: 12, color: colors.textSecondary, fontWeight: 700 }}>Documentos del pack</div>
                  <button
                    type="button"
                    onClick={() => setPackItems((items) => [...items, newPackItem()])}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 8, border: `1px solid ${colors.border}`, background: colors.background, color: colors.text, cursor: 'pointer', fontWeight: 800, fontSize: 12 }}
                  >
                    <Plus size={14} />
                    Añadir documento
                  </button>
                </div>
                <div style={{ display: 'grid', gap: 8 }}>
                  {packItems.map((item, idx) => (
                    <div key={item.key} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, alignItems: 'center', padding: 10, borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.background }}>
                      <select
                        value={item.tipoDocumento}
                        onChange={(e) => setPackItems((items) => items.map((it) => (it.key === item.key ? { ...it, tipoDocumento: e.target.value } : it)))}
                        style={{ width: '100%', padding: 8, borderRadius: 8, border: `1px solid ${colors.border}`, background: colors.surface, color: colors.text, fontSize: 13 }}
                      >
                        {FIRMA_DOCUMENTO_GRUPOS.map((grupo) => (
                          <optgroup key={grupo.key} label={grupo.label}>
                            {grupo.tipos.map((tipo) => (
                              <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <label style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 10px', borderRadius: 8, border: `1px solid ${colors.border}`, background: colors.surface, color: colors.text, cursor: 'pointer', fontSize: 11, fontWeight: 700, overflow: 'hidden' }}>
                          <Upload size={14} />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.file ? 'PDF propio' : 'Opcional: PDF propio'}
                          </span>
                          <input
                            type="file"
                            accept="application/pdf"
                            style={{ display: 'none' }}
                            onChange={(e) => {
                              const file = e.target.files?.[0] || null;
                              setPackItems((items) => items.map((it) => (it.key === item.key ? { ...it, file } : it)));
                            }}
                          />
                        </label>
                        {item.file ? (
                          <button
                            type="button"
                            title="Quitar PDF propio (volver a generar desde Holded)"
                            onClick={() => setPackItems((items) => items.map((it) => (it.key === item.key ? { ...it, file: null } : it)))}
                            style={{ padding: '8px', borderRadius: 8, border: `1px solid ${colors.border}`, background: colors.surface, cursor: 'pointer' }}
                          >
                            <X size={14} />
                          </button>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        title="Quitar fila"
                        disabled={packItems.length <= 1}
                        onClick={() => setPackItems((items) => items.filter((it) => it.key !== item.key))}
                        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: 8, border: `1px solid ${colors.border}`, background: colors.surface, color: colors.textSecondary, cursor: packItems.length <= 1 ? 'not-allowed' : 'pointer', opacity: packItems.length <= 1 ? 0.4 : 1 }}
                      >
                        <X size={16} />
                      </button>
                      <div style={{ gridColumn: '1 / -1', fontSize: 11, color: colors.textSecondary, lineHeight: 1.4 }}>
                        Documento {idx + 1}
                        {item.file ? (
                          <span style={{ color: colors.primary }}> · PDF propio ({(item.file.size / 1024).toFixed(0)} KB)</span>
                        ) : (
                          <span style={{ color: colors.success }}> · Se generará automáticamente desde Holded</span>
                        )}
                        {getFirmaDocPrepHint(item.tipoDocumento) ? (
                          <div style={{ marginTop: 4 }}>{getFirmaDocPrepHint(item.tipoDocumento)}</div>
                        ) : null}
                      </div>
                      {item.tipoDocumento === 'epis' && !item.file ? (
                        <div style={{ gridColumn: '1 / -1', display: 'grid', gap: 6, marginTop: 4 }}>
                          <div style={{ fontSize: 11, fontWeight: 800 }}>Equipos EPI (opcional)</div>
                          {(item.episRows || []).map((row, rowIdx) => (
                            <div key={`${item.key}-epi-${rowIdx}`} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 6 }}>
                              <input
                                placeholder="Equipo"
                                value={row.equipo}
                                onChange={(e) => setPackItems((items) => items.map((it) => {
                                  if (it.key !== item.key) return it;
                                  const episRows = [...(it.episRows || [])];
                                  episRows[rowIdx] = { ...episRows[rowIdx], equipo: e.target.value };
                                  return { ...it, episRows };
                                }))}
                                style={{ padding: 6, borderRadius: 6, border: `1px solid ${colors.border}`, fontSize: 11 }}
                              />
                              <input
                                placeholder="Marca"
                                value={row.marca}
                                onChange={(e) => setPackItems((items) => items.map((it) => {
                                  if (it.key !== item.key) return it;
                                  const episRows = [...(it.episRows || [])];
                                  episRows[rowIdx] = { ...episRows[rowIdx], marca: e.target.value };
                                  return { ...it, episRows };
                                }))}
                                style={{ padding: 6, borderRadius: 6, border: `1px solid ${colors.border}`, fontSize: 11 }}
                              />
                              <input
                                placeholder="Modelo"
                                value={row.modelo}
                                onChange={(e) => setPackItems((items) => items.map((it) => {
                                  if (it.key !== item.key) return it;
                                  const episRows = [...(it.episRows || [])];
                                  episRows[rowIdx] = { ...episRows[rowIdx], modelo: e.target.value };
                                  return { ...it, episRows };
                                }))}
                                style={{ padding: 6, borderRadius: 6, border: `1px solid ${colors.border}`, fontSize: 11 }}
                              />
                              <button
                                type="button"
                                disabled={(item.episRows || []).length <= 1}
                                onClick={() => setPackItems((items) => items.map((it) => {
                                  if (it.key !== item.key) return it;
                                  return { ...it, episRows: it.episRows.filter((_, i) => i !== rowIdx) };
                                }))}
                                style={{ width: 32, borderRadius: 6, border: `1px solid ${colors.border}`, background: colors.surface, cursor: 'pointer' }}
                              >
                                <X size={12} />
                              </button>
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={() => setPackItems((items) => items.map((it) => {
                              if (it.key !== item.key) return it;
                              return { ...it, episRows: [...(it.episRows || []), { equipo: '', marca: '', modelo: '' }] };
                            }))}
                            style={{ justifySelf: 'start', fontSize: 11, fontWeight: 800, padding: '4px 8px', borderRadius: 6, border: `1px solid ${colors.border}`, background: colors.surface, cursor: 'pointer' }}
                          >
                            + Añadir EPI
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 8, fontSize: 11, color: colors.textSecondary, lineHeight: 1.4 }}>
                  Los PDF se crean al pulsar «Crear pack» con los datos de Holded. Solo sube un PDF propio si quieres
                  sustituir el generado (p. ej. contrato redactado por asesoría). VRP: consentimiento <b>o</b> renuncia.
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6, fontWeight: 700 }}>Fecha inicio</div>
                  <input type="date" value={envioForm.fechaInicio} onChange={(e) => setEnvioForm((p) => ({ ...p, fechaInicio: e.target.value }))} style={{ width: '100%', padding: 10, borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.background, color: colors.text }} />
                </div>
                <div>
                  <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6, fontWeight: 700 }}>Fecha fin</div>
                  <input type="date" value={envioForm.fechaFin} onChange={(e) => setEnvioForm((p) => ({ ...p, fechaFin: e.target.value }))} style={{ width: '100%', padding: 10, borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.background, color: colors.text }} />
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6, fontWeight: 700 }}>Notas internas</div>
                <textarea
                  rows={3}
                  value={envioForm.notasInternas}
                  onChange={(e) => setEnvioForm((p) => ({ ...p, notasInternas: e.target.value }))}
                  style={{ width: '100%', padding: 10, borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.background, color: colors.text, boxSizing: 'border-box', resize: 'vertical' }}
                />
              </div>
              {selectedHoldedEmployee ? (
                <div style={{ padding: 12, borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.background, fontSize: 12, lineHeight: 1.5 }}>
                  <div style={{ fontWeight: 800, marginBottom: 6 }}>Datos que irán en los PDF (Holded)</div>
                  <div><b>Empresa:</b> {getFirmaEmpresaNombre(selectedEntity)}</div>
                  <div><b>Nombre:</b> {selectedHoldedEmployee.nombreCompleto}</div>
                  <div><b>DNI:</b> {selectedHoldedEmployee.dni || '—'}</div>
                  <div><b>Puesto:</b> {selectedHoldedEmployee.contratoPuesto || selectedHoldedEmployee.puesto || '—'}</div>
                  <div><b>Teléfono (OTP):</b> {selectedHoldedEmployee.telefono || '—'}</div>
                  <div><b>Email:</b> {selectedHoldedEmployee.email || '—'}</div>
                </div>
              ) : null}
              <button
                onClick={saveEnvio}
                disabled={savingDocumento}
                style={{ marginTop: 4, display: 'inline-flex', justifyContent: 'center', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10, border: 'none', background: colors.primary, color: '#fff', cursor: 'pointer', fontWeight: 900 }}
              >
                <Plus size={16} />
                {savingDocumento ? 'Generando PDFs y enlace...' : 'Generar pack y enlace'}
              </button>
            </div>
          </div>
        </div>

        <div style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 14, padding: 18, overflowX: 'auto' }}>
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 14 }}>Envíos de firma</div>
          {loading ? (
            <div style={{ color: colors.textSecondary }}>Cargando envíos...</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 980 }}>
              <thead>
                <tr style={{ textAlign: 'left', color: colors.textSecondary, fontSize: 12 }}>
                  {['Trabajador', 'Pack / documentos', 'Estado', 'Teléfono', 'Inicio', 'Fin', 'Firmado', 'Acciones'].map((label) => (
                    <th key={label} style={{ padding: '10px 8px', borderBottom: `1px solid ${colors.border}` }}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {envios.map((envio) => (
                  <tr key={envio.id}>
                    <td style={{ padding: '12px 8px', borderBottom: `1px solid ${colors.border}` }}>
                      <div style={{ fontWeight: 800 }}>{envio.trabajador?.nombre || '—'}</div>
                      <div style={{ fontSize: 12, color: colors.textSecondary }}>{envioLabel(envio)}</div>
                    </td>
                    <td style={{ padding: '12px 8px', borderBottom: `1px solid ${colors.border}` }}>
                      <div style={{ fontWeight: 700 }}>{(envio.documentos || []).length} documento(s)</div>
                      <div style={{ fontSize: 11, color: colors.textSecondary, lineHeight: 1.45, marginTop: 4 }}>
                        {(envio.documentos || []).map((d) => getFirmaDocumentoLabel(d.tipo_documento)).join(' · ')}
                      </div>
                    </td>
                    <td style={{ padding: '12px 8px', borderBottom: `1px solid ${colors.border}` }}>
                      {(() => {
                        const flow = flowEstadoFirma(envio);
                        const FlowIcon = flowEstadoIcon(flow.key);
                        return (
                          <div>
                            <button
                              type="button"
                              title="Ver cronología del envío"
                              onClick={() => setFirmaTimelineDoc(envio)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                padding: '6px 10px',
                                borderRadius: 999,
                                border: 'none',
                                cursor: 'pointer',
                                background: `${estadoFlowColor(flow.key, colors)}18`,
                                color: estadoFlowColor(flow.key, colors),
                                fontWeight: 900,
                                fontSize: 12,
                                fontFamily: 'inherit'
                              }}
                            >
                              <FlowIcon size={14} />
                              {flow.label}
                            </button>
                            <div style={{ marginTop: 6, fontSize: 11, color: colors.textSecondary, lineHeight: 1.35 }}>
                              <span title="Estado en base de datos">BD: {envio.estado}</span>
                              {envio.link_compartido_at ? (
                                <span>
                                  {' · '}
                                  Compartido: {new Date(envio.link_compartido_at).toLocaleString()}
                                </span>
                              ) : null}
                              {envio.portal_abierto_at ? (
                                <span>
                                  {' · '}
                                  Abierto: {new Date(envio.portal_abierto_at).toLocaleString()}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        );
                      })()}
                    </td>
                    <td style={{ padding: '12px 8px', borderBottom: `1px solid ${colors.border}` }}>{envio.trabajador?.telefono || '—'}</td>
                    <td style={{ padding: '12px 8px', borderBottom: `1px solid ${colors.border}` }}>{envio.fecha_inicio || '—'}</td>
                    <td style={{ padding: '12px 8px', borderBottom: `1px solid ${colors.border}` }}>{envio.fecha_fin || '—'}</td>
                    <td style={{ padding: '12px 8px', borderBottom: `1px solid ${colors.border}` }}>{envio.firmado_at ? new Date(envio.firmado_at).toLocaleString() : '—'}</td>
                    <td style={{ padding: '12px 8px', borderBottom: `1px solid ${colors.border}` }}>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button
                          onClick={() => copyLink(envio)}
                          disabled={!envio.portal_link}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 10px', borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.background, color: colors.text, cursor: envio.portal_link ? 'pointer' : 'not-allowed' }}
                        >
                          <Copy size={14} />
                          Copiar enlace
                        </button>
                        <button
                          onClick={() => copyShareText(envio)}
                          disabled={!envio.portal_link}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 10px', borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.background, color: colors.text, cursor: envio.portal_link ? 'pointer' : 'not-allowed' }}
                          title="Copia el mensaje completo para pegar en WhatsApp u otros canales"
                        >
                          <Copy size={14} />
                          Copiar mensaje
                        </button>
                        {envio.portal_link ? (
                          <button
                            onClick={() => openLink(envio.portal_link)}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 10px', borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.background, color: colors.text, cursor: 'pointer' }}
                          >
                            <Link2 size={14} />
                            Abrir
                          </button>
                        ) : null}
                        {envio.portal_link ? (
                          <button
                            onClick={() => openWhatsApp(envio)}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 10px', borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.background, color: colors.text, cursor: 'pointer' }}
                          >
                            <Phone size={14} />
                            WhatsApp
                          </button>
                        ) : null}
                        {envio.portal_link ? (
                          <button
                            onClick={() => openEmail(envio)}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 10px', borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.background, color: colors.text, cursor: 'pointer' }}
                          >
                            <FileText size={14} />
                            Email
                          </button>
                        ) : null}
                        <button
                          onClick={() => openFirmaAuditoria(envio)}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 10px', borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.background, color: colors.text, cursor: 'pointer', fontWeight: 700 }}
                          title="Historial de pasos: DNI, SMS, firma, IP…"
                        >
                          <Clock size={14} />
                          Auditoría
                        </button>
                        {envioTieneDocumentosFirmados(envio) ? (
                          <button
                            onClick={() => setFirmaDocsEnvio(envio)}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 10px', borderRadius: 10, border: `1px solid ${colors.success}55`, background: `${colors.success}12`, color: colors.success, cursor: 'pointer', fontWeight: 800 }}
                            title="Ver o descargar los PDF firmados del pack"
                          >
                            <FileText size={14} />
                            Ver firmados
                          </button>
                        ) : null}
                        {envio.estado !== 'cancelado' ? (
                          <button
                            onClick={() => cancelEnvio(envio)}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 10px', borderRadius: 10, border: `1px solid ${colors.error}55`, background: `${colors.error}10`, color: colors.error, cursor: 'pointer' }}
                          >
                            <XCircle size={14} />
                            Cancelar
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
                {!envios.length ? (
                  <tr>
                    <td colSpan={8} style={{ padding: 18, textAlign: 'center', color: colors.textSecondary }}>
                      Todavía no hay envíos de firma creados.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {firmaTimelineDoc ? (
        <div
          role="presentation"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16
          }}
          onClick={() => setFirmaTimelineDoc(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="firma-timeline-title"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(440px, 100%)',
              maxHeight: 'min(80vh, 560px)',
              overflow: 'auto',
              borderRadius: 16,
              background: colors.surface,
              border: `1px solid ${colors.border}`,
              boxShadow: '0 16px 48px rgba(0,0,0,0.18)',
              color: colors.text
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, padding: '16px 18px', borderBottom: `1px solid ${colors.border}` }}>
              <div>
                <div id="firma-timeline-title" style={{ fontSize: 17, fontWeight: 900 }}>
                  Seguimiento del envío
                </div>
                <div style={{ marginTop: 4, fontSize: 13, color: colors.textSecondary, fontWeight: 600 }}>
                  {firmaTimelineDoc.trabajador?.nombre || 'Trabajador'} · {envioLabel(firmaTimelineDoc)}
                </div>
              </div>
              <button
                type="button"
                aria-label="Cerrar"
                onClick={() => setFirmaTimelineDoc(null)}
                style={{
                  flexShrink: 0,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  border: `1px solid ${colors.border}`,
                  background: colors.background,
                  color: colors.text,
                  cursor: 'pointer'
                }}
              >
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: '14px 18px 18px' }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
                Estado en BD: {firmaTimelineDoc.estado}
              </div>
              <ol style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                {buildFirmaTimeline(firmaTimelineDoc).map((step, idx, arr) => (
                  <li
                    key={step.key}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '14px 1fr',
                      columnGap: 12,
                      paddingBottom: idx < arr.length - 1 ? 14 : 0
                    }}
                  >
                    <div style={{ position: 'relative', width: 14 }}>
                      <span
                        style={{
                          display: 'block',
                          width: 10,
                          height: 10,
                          marginTop: 5,
                          marginLeft: 2,
                          borderRadius: '50%',
                          background: step.display ? colors.success : colors.border,
                          boxShadow: step.display ? `0 0 0 3px ${colors.success}22` : 'none'
                        }}
                      />
                      {idx < arr.length - 1 ? (
                        <span
                          style={{
                            position: 'absolute',
                            left: '6px',
                            top: 18,
                            bottom: -14,
                            width: 2,
                            background: colors.border,
                            borderRadius: 1
                          }}
                        />
                      ) : null}
                    </div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 13, lineHeight: 1.35 }}>{step.title}</div>
                      <div style={{ marginTop: 4, fontSize: 13, color: step.display ? colors.text : colors.textSecondary, fontWeight: step.display ? 600 : 500 }}>
                        {step.display || 'Pendiente'}
                      </div>
                      {step.note ? (
                        <div style={{ marginTop: 4, fontSize: 11, color: colors.textSecondary, lineHeight: 1.35 }}>{step.note}</div>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ol>
              {envioTieneDocumentosFirmados(firmaTimelineDoc) ? (
                <button
                  type="button"
                  onClick={() => {
                    setFirmaDocsEnvio(firmaTimelineDoc);
                    setFirmaTimelineDoc(null);
                  }}
                  style={{
                    marginTop: 14,
                    width: '100%',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    padding: '10px 14px',
                    borderRadius: 10,
                    border: `1px solid ${colors.success}55`,
                    background: `${colors.success}12`,
                    color: colors.success,
                    fontWeight: 800,
                    cursor: 'pointer',
                    fontFamily: 'inherit'
                  }}
                >
                  <FileText size={16} />
                  Ver documentos firmados
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  const envio = firmaTimelineDoc;
                  setFirmaTimelineDoc(null);
                  openFirmaAuditoria(envio);
                }}
                style={{
                  marginTop: 14,
                  width: '100%',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: '10px 14px',
                  borderRadius: 10,
                  border: `1px solid ${colors.border}`,
                  background: colors.background,
                  color: colors.text,
                  fontWeight: 800,
                  cursor: 'pointer',
                  fontFamily: 'inherit'
                }}
              >
                <Clock size={16} />
                Ver auditoría completa
              </button>
              <button
                type="button"
                onClick={() => setFirmaTimelineDoc(null)}
                style={{
                  marginTop: 10,
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 10,
                  border: `1px solid ${colors.border}`,
                  background: colors.background,
                  color: colors.text,
                  fontWeight: 800,
                  cursor: 'pointer',
                  fontFamily: 'inherit'
                }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {firmaDocsEnvio ? (
        <div
          role="presentation"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16
          }}
          onClick={() => setFirmaDocsEnvio(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="firma-docs-title"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(560px, 100%)',
              maxHeight: 'min(85vh, 640px)',
              overflow: 'auto',
              borderRadius: 16,
              background: colors.surface,
              border: `1px solid ${colors.border}`,
              boxShadow: '0 16px 48px rgba(0,0,0,0.18)',
              color: colors.text
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, padding: '16px 18px', borderBottom: `1px solid ${colors.border}` }}>
              <div>
                <div id="firma-docs-title" style={{ fontSize: 17, fontWeight: 900 }}>
                  Documentos del pack
                </div>
                <div style={{ marginTop: 4, fontSize: 13, color: colors.textSecondary, fontWeight: 600 }}>
                  {firmaDocsEnvio.trabajador?.nombre || 'Trabajador'} · {envioLabel(firmaDocsEnvio)}
                </div>
                {firmaDocsEnvio.firmado_at ? (
                  <div style={{ marginTop: 6, fontSize: 12, color: colors.success, fontWeight: 700 }}>
                    Firmado el {formatFirmaDate(firmaDocsEnvio.firmado_at)}
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                aria-label="Cerrar"
                onClick={() => setFirmaDocsEnvio(null)}
                style={{
                  flexShrink: 0,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  border: `1px solid ${colors.border}`,
                  background: colors.background,
                  color: colors.text,
                  cursor: 'pointer'
                }}
              >
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: '14px 18px 18px' }}>
              <div style={{ display: 'grid', gap: 10 }}>
                {documentosPackOrdenados(firmaDocsEnvio).map((doc, idx) => {
                  const firmado = !!(doc.storage_path_firmado || doc.firmado_at || doc.estado === 'firmado');
                  const verKey = `${doc.id}:firmado`;
                  const dlKey = `${doc.id}:dl:firmado`;
                  const loadingVer = firmaDocsLoadingId === verKey;
                  const loadingDl = firmaDocsLoadingId === dlKey;
                  return (
                    <div
                      key={doc.id}
                      style={{
                        padding: 12,
                        borderRadius: 12,
                        border: `1px solid ${colors.border}`,
                        background: colors.background
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 11, fontWeight: 800, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Documento {idx + 1}
                          </div>
                          <div style={{ marginTop: 4, fontWeight: 800, fontSize: 14, lineHeight: 1.35 }}>
                            {getFirmaDocumentoLabel(doc.tipo_documento)}
                          </div>
                          <div style={{ marginTop: 6, fontSize: 12, color: firmado ? colors.success : colors.textSecondary, fontWeight: 700 }}>
                            {firmado
                              ? `Firmado${doc.firmado_at ? ` · ${formatFirmaDate(doc.firmado_at)}` : ''}`
                              : 'Pendiente de firma'}
                          </div>
                        </div>
                        {firmado ? (
                          <CheckCircle size={20} color={colors.success} style={{ flexShrink: 0, marginTop: 2 }} />
                        ) : null}
                      </div>
                      {firmado ? (
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                          <button
                            type="button"
                            disabled={!!firmaDocsLoadingId}
                            onClick={() => verDocumentoPdf(doc, { firmado: true })}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '8px 10px',
                              borderRadius: 10,
                              border: `1px solid ${colors.border}`,
                              background: colors.surface,
                              color: colors.text,
                              cursor: firmaDocsLoadingId ? 'wait' : 'pointer',
                              fontWeight: 700,
                              fontSize: 12,
                              opacity: firmaDocsLoadingId && !loadingVer ? 0.6 : 1
                            }}
                          >
                            <Eye size={14} />
                            {loadingVer ? 'Abriendo…' : 'Ver PDF firmado'}
                          </button>
                          <button
                            type="button"
                            disabled={!!firmaDocsLoadingId}
                            onClick={() => descargarDocumentoPdf(doc, { firmado: true })}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '8px 10px',
                              borderRadius: 10,
                              border: `1px solid ${colors.border}`,
                              background: colors.surface,
                              color: colors.text,
                              cursor: firmaDocsLoadingId ? 'wait' : 'pointer',
                              fontWeight: 700,
                              fontSize: 12,
                              opacity: firmaDocsLoadingId && !loadingDl ? 0.6 : 1
                            }}
                          >
                            <Download size={14} />
                            {loadingDl ? 'Descargando…' : 'Descargar'}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
              {!documentosPackOrdenados(firmaDocsEnvio).length ? (
                <div style={{ padding: 12, textAlign: 'center', color: colors.textSecondary, fontSize: 13 }}>
                  No hay documentos en este envío.
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => setFirmaDocsEnvio(null)}
                style={{
                  marginTop: 16,
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 10,
                  border: `1px solid ${colors.border}`,
                  background: colors.background,
                  color: colors.text,
                  fontWeight: 800,
                  cursor: 'pointer',
                  fontFamily: 'inherit'
                }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {firmaAuditoriaEnvio ? (
        <div
          role="presentation"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16
          }}
          onClick={() => setFirmaAuditoriaEnvio(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="firma-auditoria-title"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(620px, 100%)',
              maxHeight: 'min(85vh, 680px)',
              overflow: 'auto',
              borderRadius: 16,
              background: colors.surface,
              border: `1px solid ${colors.border}`,
              boxShadow: '0 16px 48px rgba(0,0,0,0.18)',
              color: colors.text
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, padding: '16px 18px', borderBottom: `1px solid ${colors.border}` }}>
              <div>
                <div id="firma-auditoria-title" style={{ fontSize: 17, fontWeight: 900 }}>
                  Auditoría del envío
                </div>
                <div style={{ marginTop: 4, fontSize: 13, color: colors.textSecondary, fontWeight: 600 }}>
                  {firmaAuditoriaEnvio.trabajador?.nombre || 'Trabajador'} · {envioLabel(firmaAuditoriaEnvio)}
                </div>
                <div style={{ marginTop: 6, fontSize: 11, color: colors.textSecondary, lineHeight: 1.4 }}>
                  Registro de pasos en el portal: DNI, SMS, firma, IP y navegador.
                </div>
              </div>
              <button
                type="button"
                aria-label="Cerrar"
                onClick={() => setFirmaAuditoriaEnvio(null)}
                style={{
                  flexShrink: 0,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  border: `1px solid ${colors.border}`,
                  background: colors.background,
                  color: colors.text,
                  cursor: 'pointer'
                }}
              >
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: '14px 18px 18px' }}>
              {firmaAuditoriaLoading ? (
                <div style={{ padding: 16, color: colors.textSecondary, fontSize: 13 }}>Cargando auditoría…</div>
              ) : (
                <ol style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                  {firmaAuditoriaRows.map((row, idx) => {
                    const item = describeFirmaAuditoriaRow(row);
                    return (
                      <li
                        key={item.id || idx}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '14px 1fr',
                          columnGap: 12,
                          paddingBottom: idx < firmaAuditoriaRows.length - 1 ? 14 : 0
                        }}
                      >
                        <div style={{ position: 'relative', width: 14 }}>
                          <span
                            style={{
                              display: 'block',
                              width: 10,
                              height: 10,
                              marginTop: 5,
                              marginLeft: 2,
                              borderRadius: '50%',
                              background: item.ok ? colors.success : colors.error,
                              boxShadow: item.ok ? `0 0 0 3px ${colors.success}22` : `0 0 0 3px ${colors.error}22`
                            }}
                          />
                          {idx < firmaAuditoriaRows.length - 1 ? (
                            <span
                              style={{
                                position: 'absolute',
                                left: '6px',
                                top: 18,
                                bottom: -14,
                                width: 2,
                                background: colors.border,
                                borderRadius: 1
                              }}
                            />
                          ) : null}
                        </div>
                        <div style={{ paddingBottom: 4 }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                            <div style={{ fontWeight: 800, fontSize: 13, lineHeight: 1.35 }}>{item.title}</div>
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 800,
                                padding: '2px 8px',
                                borderRadius: 999,
                                background: item.ok ? `${colors.success}18` : `${colors.error}18`,
                                color: item.ok ? colors.success : colors.error,
                                textTransform: 'uppercase',
                                letterSpacing: '0.04em'
                              }}
                            >
                              {item.resultado}
                            </span>
                          </div>
                          <div style={{ marginTop: 4, fontSize: 12, color: colors.textSecondary, fontWeight: 600 }}>
                            {item.at}
                          </div>
                          {item.note ? (
                            <div style={{ marginTop: 4, fontSize: 12, color: colors.text, lineHeight: 1.4 }}>{item.note}</div>
                          ) : null}
                          {item.ip ? (
                            <div style={{ marginTop: 4, fontSize: 11, color: colors.textSecondary, fontFamily: 'ui-monospace, monospace' }}>
                              IP: {item.ip}
                            </div>
                          ) : null}
                          {item.userAgent ? (
                            <div style={{ marginTop: 2, fontSize: 11, color: colors.textSecondary, lineHeight: 1.35 }}>
                              UA: {item.userAgent}
                            </div>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
              {!firmaAuditoriaLoading && !firmaAuditoriaRows.length ? (
                <div style={{ padding: 12, textAlign: 'center', color: colors.textSecondary, fontSize: 13 }}>
                  Todavía no hay eventos de auditoría para este envío.
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => setFirmaAuditoriaEnvio(null)}
                style={{
                  marginTop: 16,
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 10,
                  border: `1px solid ${colors.border}`,
                  background: colors.background,
                  color: colors.text,
                  fontWeight: 800,
                  cursor: 'pointer',
                  fontFamily: 'inherit'
                }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
