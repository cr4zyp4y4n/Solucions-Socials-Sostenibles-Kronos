import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FileText, RefreshCw } from 'feather-icons-react';
import { useTheme } from './ThemeContext';
import SectionHeader from './SectionHeader';
import firmaService from '../services/firmaService';
import holdedEmployeesService from '../services/holdedEmployeesService';
import { FIRMA_DEFAULT_CONTRATACION_PACK } from '../constants/firmaDocumentos';
import { generateFirmaPdfFile } from '../utils/firmaPdfGenerator';
import FirmaNewPackForm from './firma/FirmaNewPackForm';
import FirmaEnviosPanel from './firma/FirmaEnviosPanel';
import FirmaTimelineModal from './firma/FirmaTimelineModal';
import FirmaDocumentosModal from './firma/FirmaDocumentosModal';
import FirmaAuditoriaModal from './firma/FirmaAuditoriaModal';
import { FirmaButton, FirmaTabs } from './firma/FirmaUi';
import {
  envioLabel,
  initialEnvioForm,
  newPackItem,
  writeClipboardSafely
} from './firma/firmaPageHelpers';

const TABS = [
  { id: 'envios', label: 'Envíos' },
  { id: 'nuevo', label: 'Nuevo pack' }
];

export default function FirmaPage() {
  const { colors } = useTheme();
  const [activeTab, setActiveTab] = useState('envios');
  const [loading, setLoading] = useState(true);
  const [savingDocumento, setSavingDocumento] = useState(false);
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
  const [firmaPortalBaseUrl, setFirmaPortalBaseUrl] = useState('');
  const [timelineEnvio, setTimelineEnvio] = useState(null);
  const [docsEnvio, setDocsEnvio] = useState(null);
  const [docsLoadingId, setDocsLoadingId] = useState('');
  const [auditoriaEnvio, setAuditoriaEnvio] = useState(null);
  const [auditoriaRows, setAuditoriaRows] = useState([]);
  const [auditoriaLoading, setAuditoriaLoading] = useState(false);

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
      const enviosData = await firmaService.loadEnvios();
      setEnvios(enviosData);
    } catch (e) {
      setError(e?.message || 'Error cargando datos de Firma.');
    } finally {
      setLoading(false);
    }
  }, []);

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
    loadPortalUrl();
    loadAll();
  }, [loadAll, loadPortalUrl]);

  useEffect(() => {
    loadHoldedEmployees();
  }, [loadHoldedEmployees]);

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(''), 6000);
    return () => clearTimeout(t);
  }, [message]);

  const marcarEnlaceCompartido = useCallback(async (envio) => {
    if (!envio?.id) return;
    try {
      await firmaService.marcarLinkCompartidoEnvio(envio, {
        esLegacySuelto: !!envio.es_legacy_suelto
      });
    } catch (e) {
      console.warn('marcarLinkCompartidoEnvio:', e?.message || e);
    }
  }, []);

  const buildShareText = (envio) => {
    const trabajador = String(envio?.trabajador?.nombre || '').trim();
    const label = envioLabel(envio);
    const prefix = trabajador
      ? `Kronos: ${trabajador}. ${label} pendiente de firma.`
      : `Kronos: ${label} pendiente de firma.`;
    const link = String(envio?.portal_link || '').trim();
    return link ? `${prefix} Enlace: ${link}` : prefix;
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

  const copyLink = async (envio) => {
    const link = String(envio?.portal_link || '').trim();
    if (!link) {
      setError('No hay enlace de portal para copiar.');
      return;
    }
    try {
      await writeClipboardSafely(link);
      setMessage('Enlace copiado al portapapeles.');
      setError('');
      await marcarEnlaceCompartido(envio);
    } catch {
      setError('No se pudo copiar al portapapeles.');
    }
  };

  const copyShareText = async (envio) => {
    try {
      await writeClipboardSafely(buildShareText(envio));
      setMessage('Mensaje copiado al portapapeles.');
      setError('');
      await marcarEnlaceCompartido(envio);
    } catch {
      setError('No se pudo copiar el mensaje.');
    }
  };

  const normalizeWhatsAppPhone = (phone) => {
    const raw = String(phone || '').trim();
    if (!raw) return '';
    const digits = raw.replace(/[^\d+]/g, '');
    const noPlus = digits.startsWith('+') ? digits.slice(1) : digits;
    if (/^\d{9}$/.test(noPlus)) return `34${noPlus}`;
    return noPlus;
  };

  const openWhatsApp = async (envio) => {
    const to = normalizeWhatsAppPhone(envio.trabajador?.telefono || '');
    if (!to) {
      setError('El trabajador no tiene teléfono para WhatsApp.');
      return;
    }
    const url = `https://wa.me/${to}?text=${encodeURIComponent(buildShareText(envio))}`;
    await openLink(url);
    await marcarEnlaceCompartido(envio);
  };

  const openEmail = async (envio) => {
    const to = String(envio.trabajador?.email || '').trim();
    if (!to) {
      setError('El trabajador no tiene email.');
      return;
    }
    const url = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent('Documento pendiente de firma (Kronos)')}&body=${encodeURIComponent(buildShareText(envio))}`;
    await openLink(url);
    await marcarEnlaceCompartido(envio);
  };

  const openFirmaAuditoria = async (envio) => {
    setTimelineEnvio(null);
    setAuditoriaEnvio(envio);
    setAuditoriaRows([]);
    setAuditoriaLoading(true);
    setError('');
    try {
      const rows = await firmaService.loadAuditoriasForEnvio(envio);
      setAuditoriaRows(rows);
    } catch (e) {
      setError(e?.message || 'No se pudo cargar la auditoría.');
      setAuditoriaEnvio(null);
    } finally {
      setAuditoriaLoading(false);
    }
  };

  const verDocumentoPdf = async (documento) => {
    const key = `${documento.id}:firmado`;
    setDocsLoadingId(key);
    setError('');
    try {
      const url = await firmaService.getDocumentoPdfSignedUrl(documento, { firmado: true });
      await openLink(url);
    } catch (e) {
      setError(e?.message || 'No se pudo abrir el PDF.');
    } finally {
      setDocsLoadingId('');
    }
  };

  const descargarDocumentoPdf = async (documento) => {
    const key = `${documento.id}:dl:firmado`;
    setDocsLoadingId(key);
    setError('');
    try {
      await firmaService.downloadDocumentoPdf(documento, { firmado: true });
    } catch (e) {
      setError(e?.message || 'No se pudo descargar el PDF.');
    } finally {
      setDocsLoadingId('');
    }
  };

  const cancelEnvio = async (envio) => {
    if (!window.confirm('¿Seguro que quieres cancelar este envío de firma?')) return;
    try {
      await firmaService.cancelarEnvio(envio.id, { esLegacySuelto: !!envio.es_legacy_suelto });
      await loadAll();
      setMessage('Envío cancelado.');
      setError('');
    } catch (e) {
      setError(e?.message || 'No se pudo cancelar el envío.');
    }
  };

  const saveEnvio = async () => {
    if (!selectedHoldedEmployee) {
      setError('Selecciona un empleado de Holded.');
      setActiveTab('nuevo');
      return;
    }
    const contratoSinPdf = packItems.find((i) => i.tipoDocumento === 'contrato' && !i.file);
    if (contratoSinPdf) {
      setError('El contrato laboral requiere subir el PDF.');
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
      setActiveTab('envios');
      setMessage(`Pack creado. Enlace: ${result.tokenInfo.portalLink}`);
    } catch (e) {
      setError(e?.message || 'Error creando el envío.');
    } finally {
      setSavingDocumento(false);
    }
  };

  return (
    <div style={{ padding: '20px 24px 32px', color: colors.text, maxWidth: 1100, margin: '0 auto' }}>
      <SectionHeader
        icon={FileText}
        title="Firma"
        subtitle="Pack de contratación con un solo enlace. PDFs desde Holded; el trabajador firma en el portal."
        actions={(
          <FirmaButton onClick={loadAll} disabled={loading}>
            <motion.span
              animate={loading ? { rotate: 360 } : { rotate: 0 }}
              transition={loading ? { repeat: Infinity, duration: 0.8, ease: 'linear' } : {}}
              style={{ display: 'inline-flex' }}
            >
              <RefreshCw size={16} />
            </motion.span>
            Refrescar
          </FirmaButton>
        )}
      />

      <AnimatePresence mode="wait">
        {message ? (
          <motion.div
            key="msg"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            style={{
              marginBottom: 14,
              padding: 12,
              borderRadius: 12,
              background: `${colors.success}14`,
              border: `1px solid ${colors.success}44`,
              fontSize: 13
            }}
          >
            {message}
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {error ? (
          <motion.div
            key="err"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            style={{
              marginBottom: 14,
              padding: 12,
              borderRadius: 12,
              background: `${colors.error}10`,
              border: `1px solid ${colors.error}44`,
              fontSize: 13
            }}
          >
            {error}
          </motion.div>
        ) : null}
      </AnimatePresence>

      {!firmaPortalBaseUrl ? (
        <div
          style={{
            marginBottom: 18,
            padding: 14,
            borderRadius: 12,
            background: `${colors.warning}12`,
            border: `1px solid ${colors.warning}55`,
            fontSize: 13,
            lineHeight: 1.45
          }}
        >
          <strong>Falta FIRMA_PORTAL_BASE_URL</strong> en el .env de Kronos. Ejemplo:
          <code style={{ display: 'block', marginTop: 8, padding: 8, borderRadius: 8, background: colors.background, fontSize: 12 }}>
            FIRMA_PORTAL_BASE_URL=https://firma.solucionssocials.org/firmar
          </code>
        </div>
      ) : null}

      <div style={{ marginBottom: 20 }}>
        <FirmaTabs tabs={TABS} active={activeTab} onChange={setActiveTab} />
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'envios' ? (
          <motion.div
            key="tab-envios"
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 12 }}
            transition={{ duration: 0.22 }}
          >
            <FirmaEnviosPanel
              envios={envios}
              loading={loading}
              onTimeline={setTimelineEnvio}
              onCopyLink={copyLink}
              onCopyMessage={copyShareText}
              onOpenLink={openLink}
              onWhatsApp={openWhatsApp}
              onEmail={openEmail}
              onAuditoria={openFirmaAuditoria}
              onVerFirmados={setDocsEnvio}
              onCancelar={cancelEnvio}
            />
          </motion.div>
        ) : (
          <motion.div
            key="tab-nuevo"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.22 }}
          >
            <FirmaNewPackForm
              selectedEntity={selectedEntity}
              onEntityChange={setSelectedEntity}
              holdedEmployees={holdedEmployees}
              holdedLoading={holdedLoading}
              holdedError={holdedError}
              holdedSearch={holdedSearch}
              onHoldedSearchChange={setHoldedSearch}
              onReloadHolded={loadHoldedEmployees}
              selectedHoldedId={selectedHoldedId}
              onSelectHoldedId={setSelectedHoldedId}
              selectedHoldedEmployee={selectedHoldedEmployee}
              envioForm={envioForm}
              onEnvioFormChange={(patch) => setEnvioForm((p) => ({ ...p, ...patch }))}
              packItems={packItems}
              onPackItemsChange={setPackItems}
              onSave={saveEnvio}
              saving={savingDocumento}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <FirmaTimelineModal
        envio={timelineEnvio}
        onClose={() => setTimelineEnvio(null)}
        onVerFirmados={(e) => {
          setTimelineEnvio(null);
          setDocsEnvio(e);
        }}
        onAuditoria={openFirmaAuditoria}
      />

      <FirmaDocumentosModal
        envio={docsEnvio}
        loadingId={docsLoadingId}
        onClose={() => setDocsEnvio(null)}
        onVerPdf={verDocumentoPdf}
        onDescargarPdf={descargarDocumentoPdf}
      />

      <FirmaAuditoriaModal
        envio={auditoriaEnvio}
        rows={auditoriaRows}
        loading={auditoriaLoading}
        onClose={() => setAuditoriaEnvio(null)}
      />
    </div>
  );
}
