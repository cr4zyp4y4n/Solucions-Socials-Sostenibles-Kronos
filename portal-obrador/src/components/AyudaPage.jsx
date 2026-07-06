import React from 'react';
import { colors } from '../theme.js';

const PORTAL_URL = 'https://portalobrador.netlify.app';

function Step({ num, title, children }) {
  return (
    <div style={{
      display: 'flex',
      gap: 14,
      alignItems: 'flex-start'
    }}>
      <div style={{
        flexShrink: 0,
        width: 28,
        height: 28,
        borderRadius: '50%',
        background: colors.primary,
        color: '#fff',
        fontSize: 14,
        fontWeight: 800,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        {num}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6, color: colors.text }}>
          {title}
        </div>
        <div style={{ fontSize: 14, lineHeight: 1.55, color: colors.textSecondary }}>
          {children}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section style={{
      background: colors.card,
      border: `1px solid ${colors.border}`,
      borderRadius: 12,
      padding: '18px 20px',
      marginBottom: 16
    }}>
      <h2 style={{
        margin: '0 0 14px',
        fontSize: 13,
        fontWeight: 800,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        color: colors.primary
      }}>
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function AyudaPage({ onBack }) {
  return (
    <div style={{
      minHeight: '100vh',
      background: colors.background,
      padding: '20px 16px 40px'
    }}>
      <div style={{ maxWidth: 520, margin: '0 auto' }}>
        <div style={{ marginBottom: 20 }}>
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              style={{
                padding: '8px 0',
                marginBottom: 12,
                fontSize: 13,
                fontWeight: 600,
                border: 'none',
                background: 'none',
                color: colors.primary,
                cursor: 'pointer'
              }}
            >
              ← Tornar
            </button>
          ) : null}
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: colors.text }}>
            Guia d&apos;ús
          </h1>
          <p style={{ margin: '8px 0 0', fontSize: 14, color: colors.textSecondary, lineHeight: 1.5 }}>
            Traçabilitat, expedicions i entregues amb el codi QR de l&apos;etiqueta.
          </p>
        </div>

        <Section title="Accés (compte compartit)">
          <p style={{ margin: '0 0 10px', fontSize: 14, lineHeight: 1.55, color: colors.textSecondary }}>
            Obrador, transport i catering utilitzen el <strong>mateix compte</strong> al portal.
            No cal tenir Kronos instal·lat: només el navegador del mòbil.
          </p>
          <div style={{
            padding: 12,
            borderRadius: 8,
            background: `${colors.primary}10`,
            border: `1px solid ${colors.primary}30`,
            fontSize: 13,
            lineHeight: 1.5,
            color: colors.text
          }}>
            <div><strong>Portal:</strong>{' '}
              <a href={PORTAL_URL} style={{ color: colors.primary }}>{PORTAL_URL}</a>
            </div>
            <div style={{ marginTop: 6 }}>
              <strong>Usuari i contrasenya:</strong> els facilita l&apos;administració (compte compartit d&apos;equip).
            </div>
          </div>
        </Section>

        <Section title="Al obrador — expedir">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <Step num="1" title="Escaneja el QR de l'etiqueta">
              S&apos;obre la fitxa del lot (producte, caducitat, al·lèrgens).
            </Step>
            <Step num="2" title="Inicia sessió">
              Botó <em>Iniciar sessió per expedir aquest lot</em>.
            </Step>
            <Step num="3" title="Registrar expedició">
              Indica el client, opcionalment la comanda Holded, i marca si el producte està verificat abans de sortir.
            </Step>
            <Step num="4" title="Resultat">
              El lot queda <strong>expedit</strong> i l&apos;expedició en <strong>trànsit</strong> cap al servei.
            </Step>
          </div>
        </Section>

        <Section title="Al servei / catering — entregar">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <Step num="1" title="Escaneja el mateix QR">
              El transportista o qui rep al destí escaneja l&apos;etiqueta.
            </Step>
            <Step num="2" title="Inicia sessió">
              Botó <em>Iniciar sessió per confirmar l&apos;entrega</em>.
            </Step>
            <Step num="3" title="Confirmar entrega">
              Revisa producte i client. Prem <em>Confirmar entrega al destí</em>.
            </Step>
            <Step num="4" title="Acceptació del client">
              Tria <em>Client ha acceptat el producte</em> si el servei confirma la recepció,
              o l&apos;opció sense confirmació explícita si cal.
            </Step>
            <Step num="5" title="Resultat">
              L&apos;expedició passa a <strong>entregat</strong> (visible també a Kronos).
            </Step>
          </div>
        </Section>

        <Section title="Consulta pública (sense login)">
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: colors.textSecondary }}>
            Qualsevol persona pot escanejar el QR i veure la informació de traçabilitat sense iniciar sessió.
            Només cal login per <strong>expedir</strong> o <strong>confirmar l&apos;entrega</strong>.
          </p>
        </Section>

        <Section title="Si hi ha un problema">
          <ul style={{
            margin: 0,
            paddingLeft: 20,
            fontSize: 14,
            lineHeight: 1.6,
            color: colors.textSecondary
          }}>
            <li>Producte en mal estat, temperatura o etiquetatge: avisa l&apos;obrador.</li>
            <li>A Kronos, l&apos;equip d&apos;oficina pot registrar una <strong>incidència</strong> vinculada al lot.</li>
            <li>Lot ja entregat: el portal mostra <em>Ja entregat</em> i no es pot repetir l&apos;acció.</li>
          </ul>
        </Section>

        <p style={{
          marginTop: 8,
          fontSize: 11,
          textAlign: 'center',
          color: colors.textSecondary,
          lineHeight: 1.45
        }}>
          Solucions Socials Sostenibles · Portal Obrador
        </p>
      </div>
    </div>
  );
}
