import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle, Copy, FileText, Link2, Plus, RefreshCw, Upload, Users, XCircle } from 'feather-icons-react';
import { useTheme } from './ThemeContext';
import firmaService from '../services/firmaService';

const initialTrabajador = {
  nombre: '',
  dni: '',
  telefono: '',
  email: ''
};

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
  const [savingTrabajador, setSavingTrabajador] = useState(false);
  const [savingDocumento, setSavingDocumento] = useState(false);
  const [trabajadores, setTrabajadores] = useState([]);
  const [documentos, setDocumentos] = useState([]);
  const [trabajadorForm, setTrabajadorForm] = useState(initialTrabajador);
  const [documentoForm, setDocumentoForm] = useState(initialDocumento);
  const [pdfFile, setPdfFile] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const selectedTrabajador = useMemo(
    () => trabajadores.find((t) => t.id === documentoForm.trabajadorId) || null,
    [trabajadores, documentoForm.trabajadorId]
  );

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

  const saveTrabajador = async () => {
    if (!trabajadorForm.nombre.trim() || !trabajadorForm.telefono.trim()) {
      setError('Nombre y teléfono son obligatorios para crear el trabajador.');
      return;
    }
    setSavingTrabajador(true);
    setError('');
    setMessage('');
    try {
      const created = await firmaService.createTrabajador(trabajadorForm);
      setTrabajadores((prev) => [created, ...prev]);
      setDocumentoForm((prev) => ({ ...prev, trabajadorId: created.id }));
      setTrabajadorForm(initialTrabajador);
      setMessage('Trabajador creado correctamente.');
    } catch (e) {
      setError(e?.message || 'Error creando trabajador.');
    } finally {
      setSavingTrabajador(false);
    }
  };

  const saveDocumento = async () => {
    if (!documentoForm.trabajadorId) {
      setError('Selecciona un trabajador.');
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
      const result = await firmaService.createDocumento({
        ...documentoForm,
        file: pdfFile
      });
      await loadAll();
      setDocumentoForm(initialDocumento);
      setPdfFile(null);
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 28, fontWeight: 900, color: colors.primary }}>Firma</div>
          <div style={{ color: colors.textSecondary, fontSize: 14 }}>
            Gestión interna de contratos y enlaces de firma para trabajadores.
          </div>
        </div>
        <button
          onClick={loadAll}
          disabled={loading}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.surface, color: colors.text, cursor: 'pointer', fontWeight: 800 }}
        >
          <RefreshCw size={16} />
          Refrescar
        </button>
      </div>

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
              <div style={{ fontSize: 18, fontWeight: 800 }}>Nuevo trabajador</div>
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              {[
                ['nombre', 'Nombre'],
                ['dni', 'DNI'],
                ['telefono', 'Teléfono'],
                ['email', 'Email']
              ].map(([key, label]) => (
                <div key={key}>
                  <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6, fontWeight: 700 }}>{label}</div>
                  <input
                    value={trabajadorForm[key]}
                    onChange={(e) => setTrabajadorForm((p) => ({ ...p, [key]: e.target.value }))}
                    style={{ width: '100%', padding: 10, borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.background, color: colors.text, boxSizing: 'border-box' }}
                  />
                </div>
              ))}
              <button
                onClick={saveTrabajador}
                disabled={savingTrabajador}
                style={{ marginTop: 4, display: 'inline-flex', justifyContent: 'center', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10, border: 'none', background: colors.primary, color: '#fff', cursor: 'pointer', fontWeight: 900 }}
              >
                <Plus size={16} />
                {savingTrabajador ? 'Guardando...' : 'Crear trabajador'}
              </button>
            </div>
          </div>

          <div style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 14, padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <FileText size={18} color={colors.primary} />
              <div style={{ fontSize: 18, fontWeight: 800 }}>Nuevo envío</div>
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              <div>
                <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6, fontWeight: 700 }}>Trabajador</div>
                <select
                  value={documentoForm.trabajadorId}
                  onChange={(e) => setDocumentoForm((p) => ({ ...p, trabajadorId: e.target.value }))}
                  style={{ width: '100%', padding: 10, borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.background, color: colors.text }}
                >
                  <option value="">Selecciona trabajador...</option>
                  {trabajadores.map((t) => (
                    <option key={t.id} value={t.id}>{t.nombre} · {t.telefono}</option>
                  ))}
                </select>
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
                        {doc.portal_link ? (
                          <button
                            onClick={() => openLink(doc.portal_link)}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 10px', borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.background, color: colors.text, cursor: 'pointer' }}
                          >
                            <Link2 size={14} />
                            Abrir
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
