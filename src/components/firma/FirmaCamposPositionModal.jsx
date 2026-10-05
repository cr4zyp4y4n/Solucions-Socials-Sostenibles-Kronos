import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs';
import { useTheme } from '../ThemeContext';
import FirmaModal from './FirmaModal';
import { FirmaButton } from './FirmaUi';
import {
  FIRMA_CAMPO_KEYS,
  normalizeCamposPosicion
} from '../../utils/firmaPlantillaFill';
import { pdfRectToScreen, screenRectToPdf } from '../../utils/firmaPdfCoords';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

const DEFAULT_W = 180;
const DEFAULT_H = 16;

const CAMPO_COLORS = {
  nombre: { border: '#1565c0', bg: 'rgba(21, 101, 192, 0.18)', text: '#0d47a1' },
  apellidos: { border: '#6a1b9a', bg: 'rgba(106, 27, 154, 0.18)', text: '#4a148c' },
  dni: { border: '#e65100', bg: 'rgba(230, 81, 0, 0.18)', text: '#bf360c' },
  nombre_completo: { border: '#00838f', bg: 'rgba(0, 131, 143, 0.18)', text: '#006064' },
  email: { border: '#ad1457', bg: 'rgba(173, 20, 87, 0.16)', text: '#880e4f' },
  telefono: { border: '#4527a0', bg: 'rgba(69, 39, 160, 0.16)', text: '#311b92' },
  fecha_nacimiento: { border: '#ef6c00', bg: 'rgba(239, 108, 0, 0.16)', text: '#e65100' },
  fecha: { border: '#c62828', bg: 'rgba(198, 40, 40, 0.16)', text: '#b71c1c' },
  empresa: { border: '#2e7d32', bg: 'rgba(46, 125, 50, 0.18)', text: '#1b5e20' },
  empresa_nif: { border: '#546e7a', bg: 'rgba(84, 110, 122, 0.18)', text: '#37474f' }
};

function toPdfCampo(box, pageIndex, viewport) {
  const entry = screenRectToPdf(box, pageIndex, viewport);
  if (!entry) return null;
  return { ...entry, fontSize: 10 };
}

/**
 * Editor: coloca rectángulos de Nombre / Apellidos / DNI sobre la plantilla.
 * Coordenadas PDF (origen abajo-izquierda), mismas que el sello.
 */
export default function FirmaCamposPositionModal({
  open,
  plantilla,
  pdfUrl,
  onClose,
  onSave,
  saving
}) {
  const { colors } = useTheme();
  const canvasRef = useRef(null);
  const [pdfDoc, setPdfDoc] = useState(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [numPages, setNumPages] = useState(0);
  const [viewport, setViewport] = useState(null);
  const [campos, setCampos] = useState({});
  const [activeKey, setActiveKey] = useState('nombre');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const dragRef = useRef(null);
  const resizeRef = useRef(null);
  const camposRef = useRef(campos);
  const viewportRef = useRef(null);
  const pageIndexRef = useRef(pageIndex);
  const activeKeyRef = useRef(activeKey);

  const scale = 1.15;

  useEffect(() => {
    camposRef.current = campos;
  }, [campos]);
  useEffect(() => {
    viewportRef.current = viewport;
  }, [viewport]);
  useEffect(() => {
    pageIndexRef.current = pageIndex;
  }, [pageIndex]);
  useEffect(() => {
    activeKeyRef.current = activeKey;
  }, [activeKey]);

  useEffect(() => {
    if (!open || !pdfUrl) return undefined;
    let cancelled = false;
    setLoading(true);
    setError('');
    setPdfDoc(null);
    (async () => {
      try {
        const doc = await pdfjsLib.getDocument({ url: pdfUrl }).promise;
        if (cancelled) return;
        setPdfDoc(doc);
        setNumPages(doc.numPages);
        const normalized = normalizeCamposPosicion(plantilla?.campos_posicion);
        setCampos(normalized);
        const pages = Object.values(normalized).map((c) => c.pageIndex);
        const start =
          pages.length > 0
            ? Math.min(Math.max(...pages), doc.numPages - 1)
            : 0;
        setPageIndex(start);
        setActiveKey(
          Object.keys(normalized)[0] || 'nombre'
        );
      } catch (e) {
        if (!cancelled) setError(e?.message || 'No se pudo cargar el PDF');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, pdfUrl, plantilla?.id]);

  const renderPage = useCallback(async () => {
    if (!pdfDoc || !canvasRef.current) return;
    const page = await pdfDoc.getPage(pageIndex + 1);
    const vp = page.getViewport({ scale });
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    canvas.width = vp.width;
    canvas.height = vp.height;
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    setViewport(vp);
  }, [pdfDoc, pageIndex]);

  useEffect(() => {
    renderPage().catch((e) => setError(e?.message || 'Error al renderizar'));
  }, [renderPage]);

  const placeCampoOnCurrentPage = (key) => {
    const vp = viewportRef.current;
    if (!vp || !key) return;
    const existing = camposRef.current[key];
    if (existing && existing.pageIndex === pageIndexRef.current) {
      setActiveKey(key);
      activeKeyRef.current = key;
      return;
    }
    const defaultW =
      key === 'empresa' || key === 'email' ? 280
        : key === 'fecha' || key === 'fecha_nacimiento' ? 90
          : key === 'dni' || key === 'empresa_nif' || key === 'telefono' ? 120
            : DEFAULT_W;
    const scale = viewportRef.current?.scale || 1.15;
    const w = defaultW * scale;
    const h = DEFAULT_H * scale;
    const screen = existing
      ? pdfRectToScreen({ ...existing, pageIndex: pageIndexRef.current }, vp)
      : {
          left: 40,
          top: Math.max(40, vp.height * 0.35),
          width: w,
          height: h
        };
    // Si venía de otra página, recolocamos centrado relativo al viewport actual
    if (existing && existing.pageIndex !== pageIndexRef.current && screen) {
      screen.left = Math.min(Math.max(0, screen.left), vp.width - screen.width);
      screen.top = Math.min(Math.max(0, screen.top), vp.height - screen.height);
    }
    if (!screen) return;
    const entry = toPdfCampo(screen, pageIndexRef.current, vp);
    if (!entry) return;
    const next = { ...camposRef.current, [key]: entry };
    setCampos(next);
    camposRef.current = next;
    setActiveKey(key);
    activeKeyRef.current = key;
  };

  const selectCampo = (key) => {
    const existing = camposRef.current[key];
    if (existing && Number.isFinite(existing.pageIndex)) {
      setActiveKey(key);
      activeKeyRef.current = key;
      if (existing.pageIndex !== pageIndexRef.current) {
        setPageIndex(existing.pageIndex);
      }
      return;
    }
    placeCampoOnCurrentPage(key);
  };

  const onPointerDown = (e, key) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveKey(key);
    activeKeyRef.current = key;
    const saved = camposRef.current[key];
    const vp = viewportRef.current;
    if (!saved || !vp) return;
    const screen = pdfRectToScreen(saved, vp);
    if (!screen) return;
    dragRef.current = {
      key,
      startX: e.clientX,
      startY: e.clientY,
      origLeft: screen.left,
      origTop: screen.top,
      width: screen.width,
      height: screen.height
    };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onResizeDown = (e, key) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveKey(key);
    activeKeyRef.current = key;
    const saved = camposRef.current[key];
    const vp = viewportRef.current;
    if (!saved || !vp) return;
    const screen = pdfRectToScreen(saved, vp);
    if (!screen) return;
    resizeRef.current = {
      key,
      startX: e.clientX,
      startY: e.clientY,
      origW: screen.width,
      origH: screen.height,
      left: screen.left,
      top: screen.top
    };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e) => {
    const vp = viewportRef.current;
    if (!vp) return;
    if (resizeRef.current) {
      const r = resizeRef.current;
      const dx = e.clientX - r.startX;
      const dy = e.clientY - r.startY;
      const scale = vp.scale || 1.15;
      let width = Math.max(40, Math.min(r.origW + dx, vp.width - r.left));
      let height = Math.max(12, Math.min(r.origH + dy, 48 * scale));
      const screen = { left: r.left, top: r.top, width, height };
      const entry = toPdfCampo(screen, pageIndexRef.current, vp);
      if (!entry) return;
      const next = { ...camposRef.current, [r.key]: entry };
      setCampos(next);
      camposRef.current = next;
      return;
    }
    if (!dragRef.current) return;
    const d = dragRef.current;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    let left = Math.max(0, Math.min(d.origLeft + dx, vp.width - d.width));
    let top = Math.max(0, Math.min(d.origTop + dy, vp.height - d.height));
    const screen = { left, top, width: d.width, height: d.height };
    const entry = toPdfCampo(screen, pageIndexRef.current, vp);
    if (!entry) return;
    const next = { ...camposRef.current, [d.key]: entry };
    setCampos(next);
    camposRef.current = next;
  };

  const onPointerUp = () => {
    dragRef.current = null;
    resizeRef.current = null;
  };

  const removeCampo = (key) => {
    const next = { ...camposRef.current };
    delete next[key];
    setCampos(next);
    camposRef.current = next;
  };

  const handleSave = async () => {
    await onSave(normalizeCamposPosicion(camposRef.current));
  };

  const boxesOnPage = FIRMA_CAMPO_KEYS
    .map(({ key, label }) => {
      const saved = campos[key];
      if (!saved || saved.pageIndex !== pageIndex || !viewport) return null;
      const screen = pdfRectToScreen(saved, viewport);
      if (!screen) return null;
      return { key, label, screen };
    })
    .filter(Boolean);

  const placedKeys = Object.keys(campos);

  return (
    <FirmaModal
      open={open}
      onClose={onClose}
      titleId="firma-campos-pos-title"
      title="Campos auto-relleno"
      subtitle="Solo los campos que coloques se rellenan desde Holded (o empresa del pack). El resto se deja en blanco."
      width={940}
      footer={(
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: colors.textSecondary, marginRight: 'auto' }}>
            {placedKeys.length
              ? `Campos: ${placedKeys.map((k) => FIRMA_CAMPO_KEYS.find((c) => c.key === k)?.label || k).join(', ')}`
              : 'Ningún campo colocado'}
          </span>
          <FirmaButton variant="ghost" onClick={onClose}>
            Cerrar
          </FirmaButton>
          <FirmaButton disabled={saving || loading} onClick={handleSave}>
            {saving ? 'Guardando…' : 'Guardar campos'}
          </FirmaButton>
        </div>
      )}
    >
      {error ? (
        <div style={{ color: colors.danger || '#c62828', fontSize: 13, marginBottom: 8 }}>{error}</div>
      ) : null}
      {loading ? (
        <div style={{ color: colors.textSecondary, fontSize: 13 }}>Cargando PDF…</div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
            <FirmaButton
              size="sm"
              variant="ghost"
              disabled={pageIndex <= 0}
              onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
            >
              ← Página
            </FirmaButton>
            <span style={{ fontSize: 13, fontWeight: 700 }}>
              {pageIndex + 1} / {numPages || '—'}
            </span>
            <FirmaButton
              size="sm"
              variant="ghost"
              disabled={pageIndex >= numPages - 1}
              onClick={() => setPageIndex((p) => Math.min(numPages - 1, p + 1))}
            >
              Página →
            </FirmaButton>
            <span style={{ width: 1, height: 20, background: colors.border, margin: '0 4px' }} />
            {FIRMA_CAMPO_KEYS.map(({ key, label }) => {
              const active = activeKey === key;
              const placed = Boolean(campos[key]);
              const c = CAMPO_COLORS[key];
              return (
                <FirmaButton
                  key={key}
                  size="sm"
                  variant={active ? 'primary' : 'ghost'}
                  onClick={() => selectCampo(key)}
                  title={placed ? `Editar ${label}` : `Añadir ${label} en esta página`}
                  style={
                    placed && !active
                      ? { borderColor: c.border, color: c.text }
                      : undefined
                  }
                >
                  {label}
                  {placed ? ' ✓' : ''}
                </FirmaButton>
              );
            })}
            {campos[activeKey] && campos[activeKey].pageIndex !== pageIndex ? (
              <FirmaButton size="sm" variant="ghost" onClick={() => placeCampoOnCurrentPage(activeKey)}>
                Mover aquí
              </FirmaButton>
            ) : null}
            {campos[activeKey] ? (
              <FirmaButton size="sm" variant="ghost" onClick={() => removeCampo(activeKey)}>
                Quitar {FIRMA_CAMPO_KEYS.find((c) => c.key === activeKey)?.label}
              </FirmaButton>
            ) : null}
          </div>
          <div
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            style={{
              position: 'relative',
              display: 'inline-block',
              maxWidth: '100%',
              overflow: 'auto',
              border: `1px solid ${colors.border}`,
              borderRadius: 8,
              background: '#525659'
            }}
          >
            <canvas ref={canvasRef} style={{ display: 'block' }} />
            {boxesOnPage.map(({ key, label, screen }) => {
              const c = CAMPO_COLORS[key] || CAMPO_COLORS.nombre;
              const isActive = key === activeKey;
              return (
                <div
                  key={key}
                  onPointerDown={(e) => onPointerDown(e, key)}
                  style={{
                    position: 'absolute',
                    left: screen.left,
                    top: screen.top,
                    width: screen.width,
                    height: screen.height,
                    border: `${isActive ? 2 : 1.5}px solid ${c.border}`,
                    background: c.bg,
                    cursor: 'grab',
                    boxSizing: 'border-box',
                    borderRadius: 2,
                    userSelect: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 4px',
                    fontSize: 10,
                    fontWeight: 700,
                    color: c.text,
                    touchAction: 'none',
                    zIndex: isActive ? 2 : 1
                  }}
                  title={`Arrastra «${label}»`}
                >
                  {label}
                  <div
                    onPointerDown={(e) => onResizeDown(e, key)}
                    style={{
                      position: 'absolute',
                      right: 0,
                      bottom: 0,
                      width: 10,
                      height: 10,
                      background: c.border,
                      cursor: 'nwse-resize',
                      borderRadius: '2px 0 0 0'
                    }}
                  />
                </div>
              );
            })}
          </div>
        </>
      )}
    </FirmaModal>
  );
}
