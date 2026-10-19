import React from 'react';
import { colors } from '../theme';
import {
  FINANCAMENT_TEXT,
  PROGRAMA_ESS_URL,
  logosDisponibles
} from '@shared-obrador/financamentInnvess';

/**
 * Bàner de publicitat del finançament InnvESS (ORDRE EMT/199/2023, base 15.j/k/l).
 * Va al peu del portal, visible a totes les pantalles incloent-hi login i traça pública.
 * Els textos i les rutes dels logotips es toquen a shared/obrador/financamentInnvess.js.
 */
export default function FinancamentBanner() {
  const logos = logosDisponibles();

  return (
    <footer
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: '16px 16px 24px',
        marginTop: 28,
        borderTop: `1px solid ${colors.border}`,
        background: colors.surface
      }}
    >
      {logos.map((logo) => (
        <img
          key={logo.clau}
          src={logo.src}
          alt={logo.alt}
          style={{ height: 30, width: 'auto', objectFit: 'contain' }}
        />
      ))}

      <span
        style={{
          fontSize: 11.5,
          lineHeight: 1.5,
          color: colors.textSecondary,
          textAlign: 'center'
        }}
      >
        {FINANCAMENT_TEXT}
        {' · '}
        <a
          href={PROGRAMA_ESS_URL}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: colors.primary, textDecoration: 'underline' }}
        >
          Programa d&apos;economia social
        </a>
      </span>
    </footer>
  );
}
