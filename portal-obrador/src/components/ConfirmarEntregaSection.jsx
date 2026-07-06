import React, { useEffect, useState } from 'react';
import {
  getLotPerQR,
  getExpedicioPerLot,
  marcarExpedicioEntregada
} from '../services/obradorPortalService.js';
import { colors } from '../theme.js';

function formatData(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('ca-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return String(iso);
  }
}

export default function ConfirmarEntregaSection({ traceCode, autoOpen = false }) {
  const [open, setOpen] = useState(autoOpen);
  const [loading, setLoading] = useState(true);
  const [expedicio, setExpedicio] = useState(null);
  const [codiLot, setCodiLot] = useState('');
  const [enviant, setEnviant] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const dades = await getLotPerQR(traceCode);
        const lot = dades?.obrador_lots;
        if (!lot?.id) throw new Error('Lot no trobat');
        if (!cancelled) setCodiLot(lot.codi_lot || '');
        const exp = await getExpedicioPerLot(lot.id);
        if (!cancelled) setExpedicio(exp);
      } catch (err) {
        if (!cancelled) setError(err?.message || String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [traceCode]);

  async function confirmar(checkClient) {
    if (!expedicio?.id) return;
    setEnviant(true);
    setError('');
    try {
      const updated = await marcarExpedicioEntregada(expedicio.id, { check_client: checkClient });
      setExpedicio(updated);
      setSuccess(
        checkClient
          ? `Entrega confirmada. El client ha acceptat el producte.`
          : `Entrega registrada (sense confirmació explícita del client).`
      );
      setOpen(false);
    } catch (err) {
      setError(err?.message || String(err));
    } finally {
      setEnviant(false);
    }
  }

  if (loading) {
    return (
      <p style={{ marginTop: 20, fontSize: 13, color: colors.textSecondary, textAlign: 'center' }}>
        Comprovant expedició…
      </p>
    );
  }

  if (success) {
    return (
      <div style={{
        marginTop: 20,
        padding: 16,
        borderRadius: 12,
        background: `${colors.success || '#1D9E75'}18`,
        border: `1px solid ${colors.success || '#1D9E75'}44`,
        fontSize: 14,
        color: colors.text,
        lineHeight: 1.5
      }}>
        {success}
      </div>
    );
  }

  if (!expedicio) {
    return (
      <div style={{
        marginTop: 20,
        padding: 14,
        borderRadius: 10,
        background: `${colors.warning || '#E5A000'}15`,
        border: `1px solid ${colors.warning || '#E5A000'}44`,
        fontSize: 13,
        color: colors.text,
        lineHeight: 1.5
      }}>
        Lot <strong>{codiLot}</strong> marcat com a expedit, però no s&apos;ha trobat cap expedició associada.
        Contacta amb l&apos;obrador.
      </div>
    );
  }

  if (expedicio.estat === 'entregat') {
    return (
      <div style={{
        marginTop: 20,
        padding: 16,
        borderRadius: 12,
        background: `${colors.success || '#1D9E75'}18`,
        border: `1px solid ${colors.success || '#1D9E75'}44`,
        fontSize: 14,
        color: colors.text
      }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Ja entregat</div>
        <div style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 1.5 }}>
          Client: <strong>{expedicio.id_client || '—'}</strong>
          {expedicio.check_client ? ' · Client ha acceptat el producte' : ''}
        </div>
      </div>
    );
  }

  return (
    <div style={{
      marginTop: 24,
      paddingTop: 20,
      borderTop: `1px solid ${colors.border}`
    }}>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          style={{
            width: '100%',
            padding: '12px 16px',
            fontSize: 14,
            fontWeight: 700,
            borderRadius: 10,
            border: 'none',
            cursor: 'pointer',
            background: colors.success || '#1D9E75',
            color: '#fff'
          }}
        >
          Confirmar entrega al destí
        </button>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: colors.success || '#1D9E75' }}>
            Entrega al servei / catering
          </div>
          <div style={{
            padding: 12,
            borderRadius: 10,
            background: colors.surface,
            border: `1px solid ${colors.border}`,
            fontSize: 13,
            lineHeight: 1.55
          }}>
            <div><strong>Lot:</strong> {codiLot}</div>
            <div><strong>Client:</strong> {expedicio.id_client || '—'}</div>
            <div><strong>Sortida obrador:</strong> {formatData(expedicio.data_sortida)}</div>
            {expedicio.comanda_holded ? (
              <div><strong>Comanda Holded:</strong> {expedicio.comanda_holded}</div>
            ) : null}
          </div>
          <p style={{ margin: 0, fontSize: 13, color: colors.textSecondary, lineHeight: 1.5 }}>
            Verifica l&apos;estat del producte a l&apos;arribar. En confirmar, l&apos;expedició passarà a <strong>entregat</strong>.
          </p>
          {error ? (
            <p style={{ margin: 0, color: colors.error || '#c0392b', fontSize: 13 }}>{error}</p>
          ) : null}
          <button
            type="button"
            disabled={enviant}
            onClick={() => confirmar(true)}
            style={{
              padding: '12px 16px',
              fontSize: 14,
              fontWeight: 700,
              borderRadius: 10,
              border: 'none',
              cursor: enviant ? 'wait' : 'pointer',
              opacity: enviant ? 0.7 : 1,
              background: colors.success || '#1D9E75',
              color: '#fff'
            }}
          >
            {enviant ? 'Registrant…' : 'Entregat — client ha acceptat el producte'}
          </button>
          <button
            type="button"
            disabled={enviant}
            onClick={() => confirmar(false)}
            style={{
              padding: '12px 16px',
              fontSize: 14,
              fontWeight: 600,
              borderRadius: 10,
              cursor: enviant ? 'wait' : 'pointer',
              background: colors.surface,
              color: colors.text,
              border: `1px solid ${colors.border}`
            }}
          >
            Entregat (sense confirmació del client)
          </button>
          <button
            type="button"
            disabled={enviant}
            onClick={() => setOpen(false)}
            style={{
              padding: '8px',
              fontSize: 13,
              border: 'none',
              background: 'none',
              color: colors.textSecondary,
              cursor: 'pointer'
            }}
          >
            Cancel·lar
          </button>
        </div>
      )}
    </div>
  );
}
