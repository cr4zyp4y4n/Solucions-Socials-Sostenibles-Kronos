import React, { useState } from 'react';
import { formatInTimeZone } from 'date-fns-tz';
import { useTheme } from '../ThemeContext';
import { getExportacioInspeccio } from '../../services/obradorSupabaseService';
import { descarregarCsvInspeccio, descarregarPdfInspeccio, taulesInspeccio } from '../../utils/obradorInspeccioExport';

const ZONA = 'Europe/Madrid';

function avuiMadrid() {
  return formatInTimeZone(new Date(), ZONA, 'yyyy-MM-dd');
}

function mesActual() {
  const avui = avuiMadrid();
  return { desde: `${avui.slice(0, 8)}01`, fins: avui };
}

function mesAnterior() {
  const [any, mes] = avuiMadrid().split('-').map(Number);
  const inici = new Date(Date.UTC(any, mes - 2, 1));
  const fi = new Date(Date.UTC(any, mes - 1, 0));
  const iso = (data) => {
    const y = data.getUTCFullYear();
    const m = String(data.getUTCMonth() + 1).padStart(2, '0');
    const d = String(data.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };
  return { desde: iso(inici), fins: iso(fi) };
}

export default function ObradorExportacioPage() {
  const { colors } = useTheme();
  const inicial = mesActual();
  const [desde, setDesde] = useState(inicial.desde);
  const [fins, setFins] = useState(inicial.fins);
  const [enviant, setEnviant] = useState('');
  const [error, setError] = useState('');
  const [resum, setResum] = useState(null);
  const [avisTruncat, setAvisTruncat] = useState(false);
  const card = colors.card || colors.surface;

  async function exportar(format) {
    setEnviant(format);
    setError('');
    setAvisTruncat(false);
    try {
      const paquet = await getExportacioInspeccio({ desde, fins });
      const taules = taulesInspeccio(paquet);
      setResum(taules.map((taula) => ({ titol: taula.titol, n: taula.files.length })));
      setAvisTruncat(Boolean(paquet.temperaturesTruncades));
      if (format === 'pdf') descarregarPdfInspeccio(paquet);
      else descarregarCsvInspeccio(paquet);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Error en preparar l\'exportació');
    } finally {
      setEnviant('');
    }
  }

  const inputStyle = {
    padding: '10px 12px',
    fontSize: 14,
    borderRadius: 8,
    border: `0.5px solid ${colors.border}`,
    background: colors.surface,
    color: colors.text
  };

  const boto = (ple) => ({
    padding: '10px 18px',
    fontSize: 14,
    fontWeight: 600,
    borderRadius: 8,
    border: ple ? 'none' : `0.5px solid ${colors.border}`,
    cursor: enviant ? 'not-allowed' : 'pointer',
    background: ple ? colors.primary : colors.surface,
    color: ple ? '#fff' : colors.text,
    opacity: enviant ? 0.7 : 1
  });

  return (
    <div style={{ padding: 32, maxWidth: 860, margin: '0 auto', color: colors.text }}>
      <header style={{ marginBottom: 20 }}>
        <h1 style={{ margin: '0 0 8px', fontSize: 28, fontWeight: 700 }}>Exportació per a inspecció</h1>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: colors.textSecondary }}>
          Descarrega les recepcions, els lots amb les recepcions d&apos;origen, les expedicions,
          les incidències amb l&apos;acció correctiva, els registres de torn i les temperatures del període.
          El PDF és per entregar o imprimir. El CSV baixa un fitxer per taula.
        </p>
      </header>

      <section style={{
        padding: 20,
        borderRadius: 12,
        border: `0.5px solid ${colors.border}`,
        background: card,
        marginBottom: 20
      }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          <button type="button" onClick={() => { const r = mesActual(); setDesde(r.desde); setFins(r.fins); }} style={boto(false)}>
            Aquest mes
          </button>
          <button type="button" onClick={() => { const r = mesAnterior(); setDesde(r.desde); setFins(r.fins); }} style={boto(false)}>
            Mes anterior
          </button>
        </div>

        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: colors.textSecondary }}>
            Des de
            <input type="date" value={desde} max={fins || undefined} onChange={(e) => setDesde(e.target.value)} style={{ ...inputStyle, display: 'block', marginTop: 6 }} />
          </label>
          <label style={{ fontSize: 13, fontWeight: 600, color: colors.textSecondary }}>
            Fins a
            <input type="date" value={fins} min={desde || undefined} onChange={(e) => setFins(e.target.value)} style={{ ...inputStyle, display: 'block', marginTop: 6 }} />
          </label>
          <button type="button" disabled={Boolean(enviant)} onClick={() => exportar('pdf')} style={boto(true)}>
            {enviant === 'pdf' ? 'Preparant PDF...' : 'Descarregar PDF'}
          </button>
          <button type="button" disabled={Boolean(enviant)} onClick={() => exportar('csv')} style={boto(false)}>
            {enviant === 'csv' ? 'Preparant CSV...' : 'Descarregar CSV'}
          </button>
        </div>
      </section>

      {error && <p style={{ color: colors.error || '#c0392b', marginTop: 0 }}>{error}</p>}

      {avisTruncat && (
        <p style={{ color: colors.warning || '#e67e22', fontSize: 14 }}>
          Hi ha més de 20.000 lectures de temperatura en aquest període. El fitxer inclou les primeres 20.000.
        </p>
      )}

      {resum && (
        <ul style={{ margin: 0, paddingLeft: 18, color: colors.textSecondary, fontSize: 14, lineHeight: 1.7 }}>
          {resum.map((linia) => (
            <li key={linia.titol}>{linia.titol}: {linia.n}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
