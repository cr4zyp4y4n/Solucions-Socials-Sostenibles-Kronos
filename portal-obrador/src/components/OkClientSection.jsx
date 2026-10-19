import React, { useEffect, useState } from 'react';
import { colors } from '../theme.js';
import { normalitzarCodiQR } from '../utils/obradorTraceCode.js';
import { confirmarOkClient, getOkClientPublic } from '../services/obradorPortalService.js';

function formatHora(iso) {
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

function faltaFuncio(err) {
  const msg = err?.message || '';
  return err?.code === '42883'
    || err?.code === 'PGRST202'
    || /obrador_ok_client_public|obrador_confirmar_ok_client|does not exist|could not find the function/i.test(msg);
}

export default function OkClientSection({ traceCode }) {
  const [estat, setEstat] = useState(null);
  const [amagat, setAmagat] = useState(false);
  const [nom, setNom] = useState('');
  const [nota, setNota] = useState('');
  const [enviant, setEnviant] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancel = false;
    const codi = normalitzarCodiQR(traceCode);
    if (!codi) return undefined;
    getOkClientPublic(codi)
      .then((data) => {
        if (!cancel) setEstat(data);
      })
      .catch((err) => {
        if (cancel) return;
        if (faltaFuncio(err)) setAmagat(true);
        else setError(err?.message || 'No s\'ha pogut comprovar l\'OK del servei.');
      });
    return () => { cancel = true; };
  }, [traceCode]);

  if (amagat) return null;
  if (!estat) {
    if (!error) return null;
    return <p style={{ marginTop: 16, color: colors.error, fontSize: 13 }}>{error}</p>;
  }
  if (!estat.te_expedicio) return null;

  if (estat.confirmat_at) {
    return (
      <div style={{
        marginTop: 20,
        padding: 16,
        borderRadius: 12,
        background: `${colors.success}18`,
        border: `1px solid ${colors.success}44`,
        fontSize: 14,
        lineHeight: 1.5
      }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>OK del servei receptor</div>
        <div>
          {estat.confirmat_nom || '—'}
          {' · '}
          {formatHora(estat.confirmat_at)}
        </div>
        {estat.confirmat_nota ? (
          <div style={{ marginTop: 6, color: colors.textSecondary }}>{estat.confirmat_nota}</div>
        ) : null}
      </div>
    );
  }

  async function confirmar(e) {
    e.preventDefault();
    const net = nom.trim();
    if (net.length < 3) {
      setError('Escriu el nom de qui rep el producte (mínim 3 caràcters).');
      return;
    }
    setEnviant(true);
    setError('');
    try {
      const data = await confirmarOkClient(normalitzarCodiQR(traceCode), net, nota.trim());
      setEstat(data);
    } catch (err) {
      setError(err?.message || 'No s\'ha pogut desar l\'OK.');
    } finally {
      setEnviant(false);
    }
  }

  const input = {
    width: '100%',
    padding: '10px 12px',
    fontSize: 14,
    borderRadius: 8,
    border: `1px solid ${colors.border}`,
    background: colors.surface,
    color: colors.text,
    boxSizing: 'border-box'
  };

  return (
    <form
      onSubmit={confirmar}
      style={{
        marginTop: 20,
        padding: 16,
        borderRadius: 12,
        border: `1px solid ${colors.border}`,
        background: colors.card,
        display: 'flex',
        flexDirection: 'column',
        gap: 10
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 15 }}>OK del servei receptor</div>
      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: colors.textSecondary }}>
        Qui rep el producte ho confirma aquí, sense compte.
        {estat.id_client ? ` Destí: ${estat.id_client}.` : ''}
        {' '}El transport marca l&apos;entrega a part.
      </p>
      <label style={{ fontSize: 13, fontWeight: 600, color: colors.textSecondary }}>
        Nom de qui rep *
        <input value={nom} onChange={(e) => setNom(e.target.value)} style={{ ...input, marginTop: 6 }} />
      </label>
      <label style={{ fontSize: 13, fontWeight: 600, color: colors.textSecondary }}>
        Observació
        <textarea
          rows={3}
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          style={{ ...input, marginTop: 6, resize: 'vertical' }}
        />
      </label>
      {error ? <p style={{ margin: 0, color: colors.error, fontSize: 13 }}>{error}</p> : null}
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
          background: colors.success,
          color: '#fff',
          opacity: enviant ? 0.7 : 1
        }}
      >
        {enviant ? 'Desant...' : 'Confirmo que he rebut el producte'}
      </button>
    </form>
  );
}
