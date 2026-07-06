import React, { useEffect, useState } from 'react';
import { supabase } from '../config/supabase';
import { colors } from '../theme';

function formatData(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('ca-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  } catch {
    return String(iso);
  }
}

const ESTAT_LABELS = {
  produit: 'Produït',
  envasat: 'Envasat',
  expedit: 'Expedit',
  retirat: 'Retirat'
};

export default function TraceLotPage({ traceCode }) {
  const [loading, setLoading] = useState(true);
  const [lot, setLot] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      setLot(null);
      const codi = String(traceCode || '').trim();
      if (!codi) {
        setError('Codi de traçabilitat no vàlid.');
        setLoading(false);
        return;
      }
      try {
        const { data, error: rpcError } = await supabase.rpc('get_obrador_lot_public', {
          p_codi: codi
        });
        if (rpcError) throw rpcError;
        if (!data) {
          setError('Lot no trobat. Comprova que l\'etiqueta sigui vàlida.');
          return;
        }
        if (!cancelled) setLot(data);
      } catch (e) {
        if (!cancelled) {
          const msg = e?.message || String(e);
          if (msg.includes('get_obrador_lot_public')) {
            setError('Falta executar database/alter_obrador_trace_public.sql a Supabase.');
          } else {
            setError(msg);
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [traceCode]);

  const allergens = Array.isArray(lot?.allergens) ? lot.allergens.filter(Boolean) : [];

  return (
    <div style={{
      minHeight: '100vh',
      background: colors.background,
      padding: '24px 16px 40px'
    }}>
      <div style={{
        maxWidth: 420,
        margin: '0 auto',
        background: colors.card,
        borderRadius: 16,
        border: `1px solid ${colors.border}`,
        padding: 24,
        boxShadow: '0 8px 32px rgba(0,0,0,0.08)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: colors.primary, letterSpacing: '0.04em' }}>
            TRAÇABILITAT
          </div>
          <h1 style={{ margin: '8px 0 0', fontSize: 22, fontWeight: 800, color: colors.text }}>
            SSS Obrador
          </h1>
        </div>

        {loading ? (
          <p style={{ textAlign: 'center', color: colors.textSecondary }}>Carregant…</p>
        ) : null}

        {!loading && error ? (
          <p style={{
            textAlign: 'center',
            color: colors.error || '#c0392b',
            fontSize: 14,
            lineHeight: 1.5
          }}>
            {error}
          </p>
        ) : null}

        {!loading && lot ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{
              textAlign: 'center',
              padding: '12px 16px',
              borderRadius: 12,
              background: `${colors.primary}12`,
              border: `1px solid ${colors.primary}30`
            }}>
              <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>Lot</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: colors.text }}>{lot.codi_lot}</div>
            </div>

            <InfoRow label="Producte" value={lot.producte} />
            <InfoRow label="Elaborat" value={formatData(lot.data_produccio)} />
            <InfoRow label="Caduca" value={formatData(lot.data_caducitat)} />
            <InfoRow
              label="Al·lèrgens"
              value={allergens.length ? allergens.join(', ') : 'Cap declarat'}
            />
            {lot.quantitat_kg != null ? (
              <InfoRow label="Quantitat" value={`${lot.quantitat_kg} kg`} />
            ) : null}
            {lot.estat ? (
              <InfoRow label="Estat" value={ESTAT_LABELS[lot.estat] || lot.estat} />
            ) : null}
          </div>
        ) : null}

        <p style={{
          marginTop: 24,
          fontSize: 11,
          textAlign: 'center',
          color: colors.textSecondary,
          lineHeight: 1.45
        }}>
          Solucions Socials Sostenibles · Informació de traçabilitat del producte
        </p>
      </div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      gap: 12,
      padding: '10px 0',
      borderBottom: `1px solid ${colors.border}`
    }}>
      <span style={{ fontSize: 13, color: colors.textSecondary }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 600, color: colors.text, textAlign: 'right' }}>{value}</span>
    </div>
  );
}
