import React, { useState } from 'react';
import {
  crearExpedicio,
  getLotPerQR,
  lotEsExpedible,
  getLotNoExpedibleMessage
} from '../services/obradorPortalService.js';
import { colors } from '../theme.js';

export default function ExpedirLotSection({ traceCode, autoOpen = false }) {
  const [open, setOpen] = useState(autoOpen);
  const [idClient, setIdClient] = useState('');
  const [comandaHolded, setComandaHolded] = useState('');
  const [checkSortida, setCheckSortida] = useState(false);
  const [observacions, setObservacions] = useState('');
  const [enviant, setEnviant] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [lotEstat, setLotEstat] = useState(null);

  const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    fontSize: 14,
    borderRadius: 8,
    border: `1px solid ${colors.border}`,
    background: colors.surface,
    color: colors.text,
    boxSizing: 'border-box'
  };

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!idClient.trim()) {
      setError('El client és obligatori.');
      return;
    }

    setEnviant(true);
    try {
      const dades = await getLotPerQR(traceCode);
      const lot = dades?.obrador_lots;
      if (!lot?.id) throw new Error('Lot no trobat');
      if (!lotEsExpedible(lot.estat)) {
        setLotEstat(lot.estat || 'bloquejat');
        throw new Error(getLotNoExpedibleMessage(lot.estat));
      }

      await crearExpedicio({
        id_lot: lot.id,
        id_client: idClient.trim(),
        comanda_holded: comandaHolded.trim() || null,
        check_sortida: checkSortida,
        check_client: false,
        observacions: observacions.trim() || null
      });

      setLotEstat('expedit');
      setSuccess(`Expedició registrada. Lot ${lot.codi_lot} marcat com a expedit.`);
    } catch (err) {
      setError(err?.message || String(err));
    } finally {
      setEnviant(false);
    }
  }

  if (lotEstat === 'expedit' && success) {
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
        {success}
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
            background: colors.primary,
            color: '#fff'
          }}
        >
          Expedir aquest lot
        </button>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: colors.primary }}>
            Expedició (personal autoritzat)
          </div>
          <label style={{ fontSize: 13, color: colors.textSecondary }}>
            Client *
            <input
              type="text"
              value={idClient}
              onChange={(e) => setIdClient(e.target.value)}
              placeholder="Nom o codi client"
              style={{ ...inputStyle, marginTop: 6 }}
              required
            />
          </label>
          <label style={{ fontSize: 13, color: colors.textSecondary }}>
            Comanda Holded
            <input
              type="text"
              value={comandaHolded}
              onChange={(e) => setComandaHolded(e.target.value)}
              placeholder="Opcional"
              style={{ ...inputStyle, marginTop: 6 }}
            />
          </label>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 14, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={checkSortida}
              onChange={(e) => setCheckSortida(e.target.checked)}
              style={{ marginTop: 3 }}
            />
            <span>
              Producte verificat abans de sortir (obrador / transport)
              <span style={{ display: 'block', fontSize: 12, color: colors.textSecondary, marginTop: 4 }}>
                Estat, etiquetatge i temperatura correctes en expedir.
              </span>
            </span>
          </label>
          <label style={{ fontSize: 13, color: colors.textSecondary }}>
            Observacions
            <textarea
              rows={2}
              value={observacions}
              onChange={(e) => setObservacions(e.target.value)}
              style={{ ...inputStyle, marginTop: 6, resize: 'vertical' }}
            />
          </label>
          {error ? (
            <p style={{ margin: 0, color: colors.error || '#c0392b', fontSize: 13 }}>{error}</p>
          ) : null}
          <button
            type="submit"
            disabled={enviant}
            style={{
              padding: '12px 16px',
              fontSize: 14,
              fontWeight: 700,
              borderRadius: 10,
              border: 'none',
              cursor: enviant ? 'wait' : 'pointer',
              opacity: enviant ? 0.7 : 1,
              background: colors.primary,
              color: '#fff'
            }}
          >
            {enviant ? 'Registrant…' : 'Registrar expedició'}
          </button>
        </form>
      )}
    </div>
  );
}
