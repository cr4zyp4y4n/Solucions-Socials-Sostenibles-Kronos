import React, { useEffect, useRef, useState } from 'react';

/**
 * Escàner QR amb càmera (BarcodeDetector natiu a Chromium/Electron).
 * onDetect(text) es crida una sola vegada per lectures vàlides.
 */
export default function ObradorQrScanner({ onDetect, onClose, colors }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [error, setError] = useState('');
  const [actiu, setActiu] = useState(false);
  const detectedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let raf = 0;
    let detector = null;

    async function start() {
      setError('');
      detectedRef.current = false;

      if (typeof window === 'undefined' || typeof window.BarcodeDetector !== 'function') {
        setError('Aquest dispositiu no suporta escàner QR natiu. Enganxa el codi manualment.');
        return;
      }

      try {
        detector = new window.BarcodeDetector({ formats: ['qr_code'] });
      } catch {
        setError('No s\'ha pogut iniciar el detector QR.');
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setActiu(true);
      } catch (err) {
        setError(err?.message || 'No s\'ha pogut accedir a la càmera.');
        return;
      }

      const tick = async () => {
        if (cancelled || detectedRef.current) return;
        const video = videoRef.current;
        if (video && video.readyState >= 2) {
          try {
            const codes = await detector.detect(video);
            const raw = codes?.[0]?.rawValue;
            if (raw && !detectedRef.current) {
              detectedRef.current = true;
              onDetect?.(String(raw));
              return;
            }
          } catch {
            /* frame sense QR */
          }
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }

    start();

    return () => {
      cancelled = true;
      if (raf) cancelAnimationFrame(raf);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [onDetect]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.65)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1100,
        padding: 24
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: colors?.card || '#fff',
          borderRadius: 12,
          padding: 16,
          width: '100%',
          maxWidth: 420,
          border: `0.5px solid ${colors?.border || '#ddd'}`
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: '0 0 12px', fontSize: 16, color: colors?.text }}>
          Escanejar QR
        </h3>
        <div
          style={{
            position: 'relative',
            background: '#000',
            borderRadius: 8,
            overflow: 'hidden',
            aspectRatio: '4 / 3'
          }}
        >
          <video
            ref={videoRef}
            muted
            playsInline
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>
        {error ? (
          <p style={{ margin: '12px 0 0', color: colors?.error || '#c0392b', fontSize: 13 }}>{error}</p>
        ) : (
          <p style={{ margin: '12px 0 0', fontSize: 13, color: colors?.textSecondary }}>
            {actiu ? 'Apunta al QR de l\'etiqueta…' : 'Iniciant càmera…'}
          </p>
        )}
        <button
          type="button"
          onClick={onClose}
          style={{
            marginTop: 14,
            width: '100%',
            padding: '10px 14px',
            borderRadius: 8,
            border: `0.5px solid ${colors?.border || '#ddd'}`,
            background: colors?.surface || '#f5f5f5',
            color: colors?.text,
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          Tancar
        </button>
      </div>
    </div>
  );
}
