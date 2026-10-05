import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
// Worker local (webpack asset/resource) — unpkg falla por CSP/connect-src en Electron
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs';
import { useTheme } from '../ThemeContext';
import FirmaModal from './FirmaModal';
import { FirmaButton } from './FirmaUi';
import { pdfRectToScreen, screenRectToPdf } from '../../utils/firmaPdfCoords';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

const DEFAULT_W = 145;
const DEFAULT_H = 38;

/** Un objeto legado o un array → mapa pageIndex → rectángulo PDF. */
function parseSelloMap(raw) {
  const map = new Map();
  if (raw == null) return map;
  const list = Array.isArray(raw) ? raw : [raw];
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const pageIndex = Math.floor(Number(item.pageIndex));
    const x = Number(item.x);
    const y = Number(item.y);
    const width = Number(item.width) || DEFAULT_W;
    const height = Number(item.height) || DEFAULT_H;
    if (!Number.isFinite(pageIndex) || pageIndex < 0) continue;
    if (![x, y, width, height].every((n) => Number.isFinite(n))) continue;
    map.set(pageIndex, { pageIndex, x, y, width, height });
  }
  return map;
}

function mapToArray(map) {
  return [...map.values()].sort((a, b) => a.pageIndex - b.pageIndex);
}

function defaultScreenBox(vp) {
  const scale = vp.scale || 1;
  const w = DEFAULT_W * scale;
  const h = DEFAULT_H * scale;
  return {
    left: Math.max(16, vp.width - w - 28),
    top: Math.max(16, vp.height - h - 40),
    width: w,
    height: h
  };
}

/**
 * Editor de sello: solo en las páginas que elijas.
 * Navegar no añade sellos; hay que pulsar «Añadir sello aquí».
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
  const [pdfDoc, setPdfDoc] = useState(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [numPages, setNumPages] = useState(0);
  const [viewport, setViewport] = useState(null);
  const [box, setBox] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selloMap, setSelloMap] = useState(() => new Map());
  const dragRef = useRef(null);
  const boxRef = useRef(null);
  const selloMapRef = useRef(selloMap);
  const pageIndexRef = useRef(pageIndex);
  const viewportRef = useRef(null);

  const scale = 1.15;

  useEffect(() => {
    boxRef.current = box;
  }, [box]);
  useEffect(() => {
    selloMapRef.current = selloMap;
  }, [selloMap]);
  useEffect(() => {
    pageIndexRef.current = pageIndex;
  }, [pageIndex]);
  useEffect(() => {
    viewportRef.current = viewport;
  }, [viewport]);

  useEffect(() => {
    if (!open || !pdfUrl) return undefined;
    let cancelled = false;
    setLoading(true);
    setError('');
    setPdfDoc(null);
    setBox(null);
    (async () => {
      try {
        const doc = await pdfjsLib.getDocument({ url: pdfUrl }).promise;
        if (cancelled) return;
        setPdfDoc(doc);
        setNumPages(doc.numPages);
        const map = parseSelloMap(plantilla?.sello_posicion);
        setSelloMap(map);
        selloMapRef.current = map;
        const pagesWithSeal = [...map.keys()].sort((a, b) => a - b);
        const startPage =
          pagesWithSeal.length > 0
            ? Math.min(pagesWithSeal[0], doc.numPages - 1)
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
    const saved = selloMapRef.current.get(pageIndex);
    setBox(saved ? pdfRectToScreen(saved, vp) : null);
  }, [pdfDoc, pageIndex]);

  useEffect(() => {
    renderPage().catch((e) => setError(e?.message || 'Error al renderizar'));
  }, [renderPage]);

  /** Solo actualiza el mapa si esta página ya tiene sello (o acabamos de añadirlo). */
  const commitCurrentBoxToMap = useCallback(() => {
    const current = boxRef.current;
    const vp = viewportRef.current;
    const idx = pageIndexRef.current;
    if (!current || !vp || !selloMapRef.current.has(idx)) {
      return selloMapRef.current;
    }
    const entry = screenRectToPdf(current, idx, vp);
    if (!entry) return selloMapRef.current;
    const next = new Map(selloMapRef.current);
    next.set(idx, entry);
    setSelloMap(next);
    selloMapRef.current = next;
    return next;
  }, []);

  const goToPage = (nextIndex) => {
    commitCurrentBoxToMap();
    setPageIndex(nextIndex);
  };

  const addSealHere = () => {
    const vp = viewportRef.current;
    const idx = pageIndexRef.current;
    if (!vp) return;
    const screen = defaultScreenBox(vp);
    const entry = screenRectToPdf(screen, idx, vp);
    if (!entry) return;
    const next = new Map(selloMapRef.current);
    next.set(idx, entry);
    setSelloMap(next);
    selloMapRef.current = next;
    setBox(screen);
  };

  const removeSealHere = () => {
    const idx = pageIndexRef.current;
    const next = new Map(selloMapRef.current);
    next.delete(idx);
    setSelloMap(next);
    selloMapRef.current = next;
    setBox(null);
  };

  const clearAllSeals = () => {
    const next = new Map();
    setSelloMap(next);
    selloMapRef.current = next;
    setBox(null);
  };

  const copyToAllPages = () => {
    const vp = viewportRef.current;
    const current = boxRef.current;
    const idx = pageIndexRef.current;
    if (!vp || !current || !numPages) return;
    const template = screenRectToPdf(current, idx, vp);
    if (!template) return;
    const next = new Map();
    for (let i = 0; i < numPages; i += 1) {
      next.set(i, { ...template, pageIndex: i });
    }
    setSelloMap(next);
    selloMapRef.current = next;
  };

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
    const next = commitCurrentBoxToMap();
    await onSave(mapToArray(next));
  };

  const pagesWithSeal = [...selloMap.keys()].sort((a, b) => a - b);
  const currentPageHasSeal = selloMap.has(pageIndex);
  const pagesLabel =
    pagesWithSeal.length > 12
      ? `${pagesWithSeal.length} páginas (1–${numPages})`
      : pagesWithSeal.length
        ? pagesWithSeal.map((p) => p + 1).join(', ')
        : '';

  return (
    <FirmaModal
      open={open}
      onClose={onClose}
      titleId="firma-sello-pos-title"
      title="Posición del sello de aceptación"
      subtitle="El sello solo aparece en las páginas donde lo añadas. Navegar no crea sellos automáticamente."
      width={920}
      footer={(
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: colors.textSecondary, marginRight: 'auto' }}>
            {pagesWithSeal.length
              ? `Sellos en páginas: ${pagesLabel}`
              : 'Ningún sello — el PDF se firmará sin marca visual (o añádelo donde haga falta)'}
          </span>
          <FirmaButton variant="ghost" onClick={onClose}>
            Cerrar
          </FirmaButton>
          <FirmaButton disabled={saving || loading} onClick={handleSave}>
            {saving ? 'Guardando…' : 'Guardar sellos'}
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
              onClick={() => goToPage(Math.max(0, pageIndex - 1))}
            >
              ← Página
            </FirmaButton>
            <span style={{ fontSize: 13, fontWeight: 700 }}>
              {pageIndex + 1} / {numPages || '—'}
              {currentPageHasSeal ? (
                <span style={{ marginLeft: 8, color: colors.success || '#2e7d32', fontWeight: 700 }}>
                  · sello
                </span>
              ) : (
                <span style={{ marginLeft: 8, color: colors.textSecondary, fontWeight: 600 }}>
                  · sin sello
                </span>
              )}
            </span>
            <FirmaButton
              size="sm"
              variant="ghost"
              disabled={pageIndex >= numPages - 1}
              onClick={() => goToPage(Math.min(numPages - 1, pageIndex + 1))}
            >
              Página →
            </FirmaButton>
            <span style={{ width: 1, height: 20, background: colors.border, margin: '0 4px' }} />
            {currentPageHasSeal ? (
              <FirmaButton size="sm" variant="ghost" onClick={removeSealHere}>
                Quitar de esta página
              </FirmaButton>
            ) : (
              <FirmaButton size="sm" onClick={addSealHere}>
                Añadir sello aquí
              </FirmaButton>
            )}
            {currentPageHasSeal && numPages > 1 ? (
              <FirmaButton
                size="sm"
                variant="ghost"
                onClick={copyToAllPages}
                title="Copia la posición actual a todas las páginas"
              >
                Copiar a todas ({numPages})
              </FirmaButton>
            ) : null}
            {pagesWithSeal.length > 0 ? (
              <FirmaButton size="sm" variant="ghost" onClick={clearAllSeals}>
                Quitar todos
              </FirmaButton>
            ) : null}
          </div>
          <div
            ref={null}
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
            ) : (
              <div
                style={{
                  position: 'absolute',
                  left: 12,
                  top: 12,
                  padding: '6px 10px',
                  borderRadius: 6,
                  background: 'rgba(0,0,0,0.55)',
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 600,
                  pointerEvents: 'none'
                }}
              >
                Esta página no tiene sello. Usa «Añadir sello aquí» si lo necesitas.
              </div>
            )}
          </div>
        </>
      )}
    </FirmaModal>
  );
}
