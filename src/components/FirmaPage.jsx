import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle, Copy, FileText, Link2, Phone, Plus, RefreshCw, Upload, Users, XCircle } from 'feather-icons-react';
import { useTheme } from './ThemeContext';
import firmaService from '../services/firmaService';
import holdedEmployeesService from '../services/holdedEmployeesService';
import SectionHeader from './SectionHeader';

const initialDocumento = {
  trabajadorId: '',
  tipoDocumento: 'contrato',
  fechaInicio: '',
  fechaFin: '',
  notasInternas: ''
};

const estadoColor = (estado, colors) => {
  switch (estado) {
    case 'firmado': return colors.success;
    case 'cancelado': return colors.error;
    case 'caducado': return colors.warning;
    case 'enviado': return colors.info;
    default: return colors.textSecondary;
  }
};

export default function FirmaPage() {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [savingDocumento, setSavingDocumento] = useState(false);
  const [trabajadores, setTrabajadores] = useState([]);
  const [documentos, setDocumentos] = useState([]);
  const [documentoForm, setDocumentoForm] = useState(initialDocumento);
  const [pdfFile, setPdfFile] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [selectedEntity, setSelectedEntity] = useState('EI_SSS');
  const [holdedEmployees, setHoldedEmployees] = useState([]);
  const [holdedLoading, setHoldedLoading] = useState(false);
  const [holdedError, setHoldedError] = useState('');
  const [holdedSearch, setHoldedSearch] = useState('');
  const [selectedHoldedId, setSelectedHoldedId] = useState('');

  const selectedTrabajador = useMemo(
    () => trabajadores.find((t) => t.id === documentoForm.trabajadorId) || null,
    [trabajadores, documentoForm.trabajadorId]
  );

  const selectedHoldedEmployee = useMemo(
    () => holdedEmployees.find((e) => String(e.id) === String(selectedHoldedId)) || null,
    [holdedEmployees, selectedHoldedId]
  );

  const entityToCompany = useMemo(() => ({
    EI_SSS: 'solucions',
    MENJAR_DHORT: 'menjar'
  }), []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [trabajadoresData, documentosData] = await Promise.all([
        firmaService.loadTrabajadores(),
        firmaService.loadDocumentos()
      ]);
      setTrabajadores(trabajadoresData);
      setDocumentos(documentosData);
    } catch (e) {
      setError(e?.message || 'Error cargando datos de Firma.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

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

  const saveDocumento = async () => {
    if (!selectedHoldedEmployee) {
      setError('Selecciona un empleado de Holded.');
      return;
    }
    if (!pdfFile) {
      setError('Sube un PDF antes de guardar el envío.');
      return;
    }
    setSavingDocumento(true);
    setError('');
    setMessage('');
    try {
      const trabajador = await firmaService.getOrCreateTrabajadorFromHolded(selectedHoldedEmployee);
      const result = await firmaService.createDocumento({
        ...documentoForm,
        trabajadorId: trabajador.id,
        file: pdfFile
      });
      await loadAll();
      setDocumentoForm(initialDocumento);
      setPdfFile(null);
      setSelectedHoldedId('');
      setMessage(`Envío creado correctamente. Enlace generado: ${result.tokenInfo.portalLink}`);
    } catch (e) {
      setError(e?.message || 'Error creando envío de firma.');
    } finally {
      setSavingDocumento(false);
    }
  };

  const copyLink = async (link) => {
    try {
      await navigator.clipboard.writeText(link);
      setMessage('Enlace copiado al portapapeles.');
      setError('');
    } catch (_) {
      setError('No se ha podido copiar el enlace.');
    }
  };

  const buildShareText = (doc) => {
    const trabajador = String(doc?.trabajador?.nombre || '').trim();
    const prefix = trabajador ? `Kronos: ${trabajador}. Documento pendiente de firma.` : 'Kronos: documento pendiente de firma.';
    const link = String(doc?.portal_link || '').trim();
    return link ? `${prefix} Enlace: ${link}` : prefix;
  };

  const copyShareText = async (doc) => {
    const text = buildShareText(doc);
    try {
      await navigator.clipboard.writeText(text);
      setMessage('Mensaje copiado al portapapeles.');
      setError('');
    } catch (_) {
      setError('No se ha podido copiar el mensaje.');
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
  };

  const cancelDocumento = async (id) => {
    if (!window.confirm('¿Seguro que quieres cancelar este envío de firma?')) return;
    try {
      await firmaService.cancelarDocumento(id);
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
        subtitle="Gestión interna de contratos y enlaces de firma para trabajadores."
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
              <div style={{ fontSize: 18, fontWeight: 800 }}>Nuevo envío</div>
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6, fontWeight: 700 }}>Tipo documento</div>
                  <select
                    value={documentoForm.tipoDocumento}
                    onChange={(e) => setDocumentoForm((p) => ({ ...p, tipoDocumento: e.target.value }))}
                    style={{ width: '100%', padding: 10, borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.background, color: colors.text }}
                  >
                    <option value="contrato">Contrato</option>
                    <option value="baja">Baja</option>
                    <option value="anexo">Anexo</option>
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6, fontWeight: 700 }}>PDF</div>
                  <label style={{ width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 10, borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.background, color: colors.text, cursor: 'pointer', boxSizing: 'border-box' }}>
                    <Upload size={16} />
                    {pdfFile ? pdfFile.name : 'Subir PDF'}
                    <input
                      type="file"
                      accept="application/pdf"
                      style={{ display: 'none' }}
                      onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                    />
                  </label>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6, fontWeight: 700 }}>Fecha inicio</div>
                  <input type="date" value={documentoForm.fechaInicio} onChange={(e) => setDocumentoForm((p) => ({ ...p, fechaInicio: e.target.value }))} style={{ width: '100%', padding: 10, borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.background, color: colors.text }} />
                </div>
                <div>
                  <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6, fontWeight: 700 }}>Fecha fin</div>
                  <input type="date" value={documentoForm.fechaFin} onChange={(e) => setDocumentoForm((p) => ({ ...p, fechaFin: e.target.value }))} style={{ width: '100%', padding: 10, borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.background, color: colors.text }} />
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6, fontWeight: 700 }}>Notas internas</div>
                <textarea
                  rows={3}
                  value={documentoForm.notasInternas}
                  onChange={(e) => setDocumentoForm((p) => ({ ...p, notasInternas: e.target.value }))}
                  style={{ width: '100%', padding: 10, borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.background, color: colors.text, boxSizing: 'border-box', resize: 'vertical' }}
                />
              </div>
              {selectedTrabajador ? (
                <div style={{ fontSize: 12, color: colors.textSecondary }}>
                  Se enviará a: <b style={{ color: colors.text }}>{selectedTrabajador.telefono}</b>
                </div>
              ) : null}
              <button
                onClick={saveDocumento}
                disabled={savingDocumento}
                style={{ marginTop: 4, display: 'inline-flex', justifyContent: 'center', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10, border: 'none', background: colors.primary, color: '#fff', cursor: 'pointer', fontWeight: 900 }}
              >
                <Plus size={16} />
                {savingDocumento ? 'Creando...' : 'Guardar y generar enlace'}
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
                  {['Trabajador', 'Tipo', 'Estado', 'Teléfono', 'Inicio', 'Fin', 'Firmado', 'Acciones'].map((label) => (
                    <th key={label} style={{ padding: '10px 8px', borderBottom: `1px solid ${colors.border}` }}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {documentos.map((doc) => (
                  <tr key={doc.id}>
                    <td style={{ padding: '12px 8px', borderBottom: `1px solid ${colors.border}` }}>
                      <div style={{ fontWeight: 800 }}>{doc.trabajador?.nombre || '—'}</div>
                      <div style={{ fontSize: 12, color: colors.textSecondary }}>{doc.file_name || 'Sin archivo'}</div>
                    </td>
                    <td style={{ padding: '12px 8px', borderBottom: `1px solid ${colors.border}` }}>{doc.tipo_documento}</td>
                    <td style={{ padding: '12px 8px', borderBottom: `1px solid ${colors.border}` }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 999, background: `${estadoColor(doc.estado, colors)}18`, color: estadoColor(doc.estado, colors), fontWeight: 900, fontSize: 12 }}>
                        {doc.estado === 'firmado' ? <CheckCircle size={14} /> : <FileText size={14} />}
                        {doc.estado}
                      </span>
                    </td>
                    <td style={{ padding: '12px 8px', borderBottom: `1px solid ${colors.border}` }}>{doc.trabajador?.telefono || '—'}</td>
                    <td style={{ padding: '12px 8px', borderBottom: `1px solid ${colors.border}` }}>{doc.fecha_inicio || '—'}</td>
                    <td style={{ padding: '12px 8px', borderBottom: `1px solid ${colors.border}` }}>{doc.fecha_fin || '—'}</td>
                    <td style={{ padding: '12px 8px', borderBottom: `1px solid ${colors.border}` }}>{doc.firmado_at ? new Date(doc.firmado_at).toLocaleString() : '—'}</td>
                    <td style={{ padding: '12px 8px', borderBottom: `1px solid ${colors.border}` }}>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button
                          onClick={() => copyLink(doc.portal_link)}
                          disabled={!doc.portal_link}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 10px', borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.background, color: colors.text, cursor: doc.portal_link ? 'pointer' : 'not-allowed' }}
                        >
                          <Copy size={14} />
                          Copiar enlace
                        </button>
                        <button
                          onClick={() => copyShareText(doc)}
                          disabled={!doc.portal_link}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 10px', borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.background, color: colors.text, cursor: doc.portal_link ? 'pointer' : 'not-allowed' }}
                          title="Copia el mensaje completo para pegar en WhatsApp u otros canales"
                        >
                          <Copy size={14} />
                          Copiar mensaje
                        </button>
                        {doc.portal_link ? (
                          <button
                            onClick={() => openLink(doc.portal_link)}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 10px', borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.background, color: colors.text, cursor: 'pointer' }}
                          >
                            <Link2 size={14} />
                            Abrir
                          </button>
                        ) : null}
                        {doc.portal_link ? (
                          <button
                            onClick={() => openWhatsApp(doc)}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 10px', borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.background, color: colors.text, cursor: 'pointer' }}
                          >
                            <Phone size={14} />
                            WhatsApp
                          </button>
                        ) : null}
                        {doc.portal_link ? (
                          <button
                            onClick={() => openEmail(doc)}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 10px', borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.background, color: colors.text, cursor: 'pointer' }}
                          >
                            <FileText size={14} />
                            Email
                          </button>
                        ) : null}
                        {doc.estado !== 'cancelado' ? (
                          <button
                            onClick={() => cancelDocumento(doc.id)}
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
                {!documentos.length ? (
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
    </div>
  );
}
