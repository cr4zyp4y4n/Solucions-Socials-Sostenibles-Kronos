import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import logoObrador from '../../../PNGCORCOLOR.png';

/** QR d'etiqueta obrador amb logo SSS al centre (nivell H per mantenir lectura). */
export default function ObradorQrCode({ value, size = 160 }) {
  if (!value) return null;

  const badgePx = Math.max(28, Math.round(size * 0.24));
  const logoPx = Math.max(22, Math.round(badgePx * 0.82));

  return (
    <div
      style={{
        position: 'relative',
        width: size,
        height: size,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <QRCodeSVG
        value={value}
        size={size}
        level="H"
        marginSize={2}
      />
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          width: badgePx,
          height: badgePx,
          background: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 0 0 1px #fff'
        }}
      >
        <img
          src={logoObrador}
          alt=""
          style={{
            width: logoPx,
            height: logoPx,
            objectFit: 'contain'
          }}
        />
      </div>
    </div>
  );
}
