import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { useTheme } from '../ThemeContext';
import FirmaModal from './FirmaModal';
import { FirmaButton } from './FirmaUi';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

const DEFAULT_W = 145;
const DEFAULT_H = 38;

/**
 * Editor: previsualiza el PDF y permite arrastrar el rectángulo del sello de aceptación.
 * Guarda coordenadas PDF (origen abajo-izquierda).
 */
export default function FirmaSelloPositionModal({
  open,
  plantilla,
  pdfUrl,
  onClose,
  onSave,
  saving
}) {
  const { colors } = useTheme();
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const [pdfDoc, setPdfDoc] = useState(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [numPages, setNumPages] = useState(0);
  const [viewport, setViewport] = useState(null);
  const [box, setBox] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const dragRef = useRef(null);
  const boxRef = useRef(null);

  const scale = 1.15;

  useEffect(() => {
    boxRef.current = box;
  }, [box]);

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
        const saved = plantilla?.sello_posicion;
        const startPage =
          saved && Number.isFinite(saved.pageIndex)
            ? Math.min(Math.max(0, Math.floor(saved.pageIndex)), doc.numPages - 1)
            : Math.max(0, doc.numPages - 1);
        setPageIndex(startPage);
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

    const saved = plantilla?.sello_posicion;
    if (
      saved &&
      Math.floor(saved.pageIndex) === pageIndex &&
      Number.isFinite(saved.x) &&
      Number.isFinite(saved.y)
    ) {
      const w = (saved.width || DEFAULT_W) * scale;
      const h = (saved.height || DEFAULT_H) * scale;
      setBox({
        left: saved.x * scale,
        top: vp.height - saved.y * scale - h,
        width: w,
        height: h
      });
    } else {
      const w = DEFAULT_W * scale;
      const h = DEFAULT_H * scale;
      setBox({
        left: Math.max(16, vp.width - w - 28),
        top: Math.max(16, vp.height - h - 40),
        width: w,
        height: h
      });
    }
  }, [pdfDoc, pageIndex, plantilla?.sello_posicion]);

  useEffect(() => {
    renderPage().catch((e) => setError(e?.message || 'Error al renderizar'));
  }, [renderPage]);

  const onPointerDown = (e) => {
    const current = boxRef.current;
    if (!current) return;
    e.preventDefault();
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origLeft: current.left,
      origTop: current.top
    };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e) => {
    if (!dragRef.current || !viewport) return;
    const current = boxRef.current;
    if (!current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    let left = dragRef.current.origLeft + dx;
    let top = dragRef.current.origTop + dy;
    left = Math.max(0, Math.min(left, viewport.width - current.width));
    top = Math.max(0, Math.min(top, viewport.height - current.height));
    setBox({ ...current, left, top });
  };

  const onPointerUp = () => {
    dragRef.current = null;
  };

  const handleSave = async () => {
    const current = boxRef.current;
    if (!current || !viewport) return;
    const selloPosicion = {
      pageIndex,
      x: Math.round((current.left / scale) * 10) / 10,
      y: Math.round(((viewport.height - current.top - current.height) / scale) * 10) / 10,
      width: Math.round((current.width / scale) * 10) / 10,
      height: Math.round((current.height / scale) * 10) / 10
    };
    await onSave(selloPosicion);
  };

  return (
    <FirmaModal
      open={open}
      onClose={onClose}
      titleId="firma-sello-pos-title"
      title="Posición del sello de aceptación"
      subtitle="Arrastra el rectángulo al hueco de firma. Se usará en packs nuevos de esta plantilla."
      width={920}
      footer={(
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <FirmaButton variant="ghost" onClick={onClose}>
            Cancelar
          </FirmaButton>
          <FirmaButton disabled={saving || !box || loading} onClick={handleSave}>
            {saving ? 'Guardando…' : 'Guardar posición'}
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
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
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
          </div>
          <div
            ref={wrapRef}
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
            {box ? (
              <div
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                style={{
                  position: 'absolute',
                  left: box.left,
                  top: box.top,
                  width: box.width,
                  height: box.height,
                  border: '1.5px solid #2e7d32',
                  background: 'rgba(76, 175, 80, 0.18)',
                  cursor: 'grab',
                  boxSizing: 'border-box',
                  borderRadius: 2,
                  userSelect: 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  padding: '2px 4px',
                  fontSize: 8,
                  lineHeight: 1.25,
                  color: '#1b5e20',
                  fontWeight: 700,
                  touchAction: 'none'
                }}
                title="Arrastra para colocar el sello"
              >
                <div>Aceptado · Kronos</div>
                <div style={{ fontWeight: 600, color: '#222' }}>Nombre · DNI · fecha</div>
              </div>
            ) : null}
          </div>
        </>
      )}
    </FirmaModal>
  );
}
