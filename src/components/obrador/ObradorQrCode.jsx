import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import logoObrador from '../../../CORBONCORSVG.svg';
// Prova alternativa: import logoObrador from '../../../CORBONCORSVG.svg';

/** QR d'etiqueta obrador amb logo SSS al centre (nivell H per mantenir lectura). */
export default function ObradorQrCode({ value, size = 160 }) {
  if (!value) return null;

  const logoPx = Math.max(22, Math.round(size * 0.2));

  return (
    <QRCodeSVG
      value={value}
      size={size}
      level="H"
      marginSize={2}
      imageSettings={{
        src: logoObrador,
        height: logoPx,
        width: logoPx,
        excavate: true
      }}
    />
  );
}
