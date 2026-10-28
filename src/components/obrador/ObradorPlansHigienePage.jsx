import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { formatInTimeZone } from 'date-fns-tz';
import { useTheme } from '../ThemeContext';
import { useObrador } from './ObradorContext';
import {
  PLANS_HIGIENE,
  PLANS_JA_COBERTS,
  definicioRegistre,
  etiquetaPla,
  iniciPeriode,
  periodesEnMes
} from '../../../shared/obrador/registresHigiene';
import { getTipusRegistre, getRegistresTorn } from '../../services/obradorSupabaseService';

const ZONA = 'Europe/Madrid';

function mesActual() {
  return formatInTimeZone(new Date(), ZONA, 'yyyy-MM');
}

function avuiMadrid() {
  return formatInTimeZone(new Date(), ZONA, 'yyyy-MM-dd');
}

function foratDelDia(dia, avui) {
  if (dia > avui) return { text: '—', to: 'futur' };
  if (dia === avui) return { text: 'Pendent', to: 'pendent' };
  return { text: 'No signat', to: 'no_signat' };
}

function etiquetaPeriode(frequencia, inici) {
  if (frequencia === 'setmanal') return `Setmana del ${formatDia(inici)}`;
  if (frequencia === 'mensual') {
    const [y, m] = inici.split('-').map(Number);
    const nom = new Date(Date.UTC(y, m - 1, 1)).toLocaleString('ca', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    return nom.charAt(0).toUpperCase() + nom.slice(1);
  }
  if (frequencia === 'trimestral') return `Trimestre des del ${formatDia(inici)}`;
  return formatDia(inici);
}

function estatPeriode(periode, frequencia, count, maxim, avui) {
  const actual = iniciPeriode(frequencia, avui);
  const max = maxim || 1;
  if (periode > actual) return { text: '—', to: 'futur' };
  if (count >= max) return { text: 'Fet', to: 'fet' };
  if (periode === actual) return { text: max > 1 ? `${count} de ${max}` : 'Pendent', to: 'pendent' };
  return { text: max > 1 && count > 0 ? `${count} de ${max}` : 'No signat', to: 'no_signat' };
}

function formatDia(iso) {
  if (!iso) return '—';
  const [y, m, d] = String(iso).slice(0, 10).split('-');
  if (!y || !m || !d) return String(iso);
  return `${d}/${m}/${y}`;
}

function diesDelMes(mes) {
  const [y, m] = String(mes || '').split('-').map(Number);
  if (!y || !m) return [];
  const total = new Date(y, m, 0).getDate();
  const mm = String(m).padStart(2, '0');
  return Array.from({ length: total }, (_, index) => {
    const dd = String(index + 1).padStart(2, '0');
    return `${y}-${mm}-${dd}`;
  });
}

function quiRegistre(registre) {
  if (!registre) return '—';
  const codi = registre.codi_fichatge || '';
  const nom = registre.nom_operari || registre.operari_nom || '';
  if (codi && nom) return `${codi} · ${nom}`;
  return nom || codi || '—';
}

function resumDia(registre, forma) {
  if (!registre) return null;
  if (forma === 'clor') {
    const detall = registre.detall || {};
    return [detall.punt_mostreig, detall.nivell != null && detall.nivell !== '' ? `${detall.nivell} mg/L` : ''].filter(Boolean).join(' · ') || 'Fet';
  }
  if (forma === 'residus') {
    const detall = registre.detall || {};
    return [detall.tipus_residu, detall.quantitat, detall.desti].filter(Boolean).join(' · ') || 'Fet';
  }
  if (forma === 'assistencia') {
    const detall = registre.detall || {};
    return detall.titol || 'Sessió';
  }
  if (forma === 'manteniment') {
    const detall = registre.detall || {};
    return detall.equip || 'Manteniment';
  }
  const items = Array.isArray(registre.items) ? registre.items : [];
  if (!items.length) return 'Fet';
  return items.map((item) => `${item.ok ? 'Sí' : 'No'}${item.valor ? ` ${item.valor}` : ''}`).join(' · ');
}

export default function ObradorPlansHigienePage() {
  const { colors } = useTheme();
  const { navigateTo } = useObrador();
  const success = colors.success || '#1D9E75';
  const danger = colors.error || '#c0392b';
  const warning = colors.warning || '#e67e22';
  const avui = avuiMadrid();

  const [tipus, setTipus] = useState([]);
  const [codi, setCodi] = useState('');
  const [mes, setMes] = useState(mesActual);
  const [registres, setRegistres] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const seleccio = tipus.find((row) => row.codi === codi) || null;
  const definicio = definicioRegistre(codi);
  const forma = definicio?.forma || null;
  const items = definicio?.items || [];

  const carregarTipus = useCallback(async () => {
    setLoading(true);
    try {
      const files = await getTipusRegistre();
      setTipus(files);
      setCodi((actual) => actual || files[0]?.codi || '');
      setError('');
    } catch (err) {
      setError(err.message || 'No s\'han pogut carregar els tipus de registre.');
    } finally {
      setLoading(false);
    }
  }, []);

  const frequencia = seleccio?.frequencia;
  const carregarMes = useCallback(async () => {
    if (!codi || !mes) return;
    const dies = diesDelMes(mes);
    if (!dies.length) return;
    let desde = dies[0];
    if (frequencia === 'setmanal') desde = iniciPeriode('setmanal', dies[0]);
    if (frequencia === 'trimestral') desde = iniciPeriode('trimestral', dies[0]);
    try {
      const files = await getRegistresTorn({ desde, fins: dies[dies.length - 1], tipusCodi: codi });
      setRegistres(files);
    } catch (err) {
      setError(err.message || 'No s\'ha pogut carregar el mes.');
    }
  }, [codi, mes, frequencia]);

  useEffect(() => {
    carregarTipus();
  }, [carregarTipus]);

  useEffect(() => {
    carregarMes();
  }, [carregarMes]);

  const perDia = useMemo(() => {
    const mapa = {};
    for (const row of registres) {
      const dia = String(row.periode_inici || row.data).slice(0, 10);
      if (!mapa[dia]) mapa[dia] = [];
      mapa[dia].push(row);
    }
    return mapa;
  }, [registres]);

  const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    fontSize: 14,
    borderRadius: 8,
    border: `0.5px solid ${colors.border}`,
    background: colors.surface,
    color: colors.text,
    boxSizing: 'border-box'
  };

  const graellaDiaria = frequencia === 'diari';
  const periodica = ['setmanal', 'mensual', 'trimestral'].includes(frequencia);
  const maximPeriode = seleccio?.maxim_per_periode || (seleccio?.unic_per_periode ? 1 : null);
  const filesPeriode = periodica
    ? periodesEnMes(mes, frequencia).map((inici) => {
      const delPeriode = registres.filter((row) => {
        const clau = String(row.periode_inici || iniciPeriode(frequencia, row.data)).slice(0, 10);
        return clau === inici;
      });
      const noms = delPeriode.map(quiRegistre).filter((nom) => nom !== '—');
      return {
        inici,
        estat: estatPeriode(inici, frequencia, delPeriode.length, maximPeriode, avui),
        qui: noms.join(', ') || '—'
      };
    })
    : [];
  const columnes = items.length
    ? items.map((item) => item.etiqueta)
    : forma === 'clor'
      ? ['Punt de mostreig', 'Nivell']
      : forma === 'residus'
        ? ['Residu']
        : ['Registre'];

  return (
    <div style={{ padding: 32, maxWidth: 1100, margin: '0 auto', color: colors.text }}>
      <header style={{ marginBottom: 20 }}>
        <h1 style={{ margin: '0 0 8px', fontSize: 28, fontWeight: 700 }}>Plans d&apos;higiene</h1>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: colors.textSecondary }}>
          Els registres es signen al portal del mòbil. Aquí es consulta la llista del mes.
          No hi ha llindars: el lloc queda buit fins que els fixi l&apos;empresa d&apos;APPCC.
        </p>
      </header>

      {error ? <p style={{ color: danger }}>{error}</p> : null}
      {loading ? <p style={{ color: colors.textSecondary }}>Carregant tipus de registre…</p> : null}

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <label style={{ fontSize: 13, fontWeight: 600, minWidth: 280 }}>
          Registre
          <select value={codi} onChange={(e) => setCodi(e.target.value)} style={{ ...inputStyle, marginTop: 6 }}>
            {tipus.map((row) => (
              <option key={row.codi} value={row.codi}>
                {row.etiqueta} · {(row.codis_pla || []).map(etiquetaPla).join(', ')}
              </option>
            ))}
          </select>
        </label>
        <label style={{ fontSize: 13, fontWeight: 600 }}>
          Mes
          <input type="month" value={mes} onChange={(e) => setMes(e.target.value)} style={{ ...inputStyle, marginTop: 6 }} />
        </label>
      </div>

      {definicio?.buit ? (
        <p style={{
          padding: 14,
          borderRadius: 10,
          background: `${warning}18`,
          border: `0.5px solid ${warning}`
        }}>
          {definicio.buit}
        </p>
      ) : null}

      {graellaDiaria ? (
        <div style={{ overflowX: 'auto', marginBottom: 28 }}>
          <p style={{ margin: '0 0 12px', fontSize: 13, lineHeight: 1.45, color: colors.textSecondary }}>
            En verd, el dia ja signat. Pendent, en taronja, és només avui.
            Un dia passat sense firma queda en vermell com a No signat i no s&apos;omple després.
            Els dies que encara no han arribat surten en blanc.
          </p>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                <th style={th(colors)}>Dia</th>
                {columnes.map((col) => <th key={col} style={th(colors)}>{col}</th>)}
                <th style={th(colors)}>Qui</th>
              </tr>
            </thead>
            <tbody>
              {diesDelMes(mes).map((dia) => {
                const files = perDia[dia] || [];
                const buit = files.length === 0;
                const forat = buit ? foratDelDia(dia, avui) : null;
                const colorForat = forat?.to === 'pendent'
                  ? warning
                  : forat?.to === 'no_signat'
                    ? danger
                    : colors.textSecondary;
                const fons = buit
                  ? (forat?.to === 'pendent'
                    ? `${warning}14`
                    : forat?.to === 'no_signat'
                      ? `${danger}10`
                      : 'transparent')
                  : `${success}14`;
                const estilBuit = { ...td(colors), color: colorForat, fontWeight: forat?.to === 'futur' ? 400 : 700 };
                const estilFet = { ...td(colors), color: success, fontWeight: 600 };
                return (
                  <tr key={dia} style={{ background: fons }}>
                    <td style={buit ? td(colors) : estilFet}>{formatDia(dia)}</td>
                    {forma === 'clor' ? (
                      <>
                        <td style={buit ? estilBuit : estilFet}>
                          {buit ? forat.text : (files[0]?.detall?.punt_mostreig || '—')}
                        </td>
                        <td style={buit ? estilBuit : estilFet}>
                          {buit ? forat.text : (files[0]?.detall?.nivell != null ? `${files[0].detall.nivell} mg/L` : '—')}
                        </td>
                      </>
                    ) : items.length ? items.map((item) => {
                      const registre = files[0];
                      const resposta = (registre?.items || []).find((fila) => fila.clau === item.clau);
                      const noConforme = resposta?.ok === false;
                      return (
                        <td key={item.clau} style={buit ? estilBuit : noConforme ? { ...td(colors), color: warning, fontWeight: 700 } : estilFet}>
                          {buit ? forat.text : resposta ? `${resposta.ok ? 'Sí' : 'No'}${resposta.valor ? ` · ${resposta.valor}` : ''}` : '—'}
                        </td>
                      );
                    }) : (
                      <td style={buit ? estilBuit : estilFet}>
                        {buit ? forat.text : resumDia(files[0], forma)}
                      </td>
                    )}
                    <td style={buit ? estilBuit : estilFet}>{buit ? forat.text : quiRegistre(files[0])}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : periodica ? (
        <div style={{ marginBottom: 28 }}>
          <p style={{ margin: '0 0 12px', fontSize: 13, lineHeight: 1.45, color: colors.textSecondary }}>
            En verd, el període ja signat. Pendent és el període en curs.
            Un període ja tancat sense firma queda com a No signat.
          </p>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr>
                <th style={th(colors)}>Període</th>
                <th style={th(colors)}>Estat</th>
                <th style={th(colors)}>Qui</th>
              </tr>
            </thead>
            <tbody>
              {filesPeriode.map((fila) => {
                const color = fila.estat.to === 'fet'
                  ? success
                  : fila.estat.to === 'pendent'
                    ? warning
                    : fila.estat.to === 'no_signat'
                      ? danger
                      : colors.textSecondary;
                const fons = fila.estat.to === 'fet'
                  ? `${success}14`
                  : fila.estat.to === 'pendent'
                    ? `${warning}14`
                    : fila.estat.to === 'no_signat'
                      ? `${danger}10`
                      : 'transparent';
                return (
                  <tr key={fila.inici} style={{ background: fons }}>
                    <td style={{ ...td(colors), color, fontWeight: 600 }}>{etiquetaPeriode(frequencia, fila.inici)}</td>
                    <td style={{ ...td(colors), color, fontWeight: 700 }}>{fila.estat.text}</td>
                    <td style={{ ...td(colors), color, fontWeight: 600 }}>{fila.qui}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <ul style={{ margin: '0 0 28px', paddingLeft: 18 }}>
          {registres.length === 0 ? (
            <li style={{ color: colors.textSecondary }}>Aquest mes encara no hi ha cap registre d&apos;aquest tipus.</li>
          ) : registres.map((row) => (
            <li key={row.id} style={{ marginBottom: 6, color: success }}>
              {formatDia(row.data)} · {resumDia(row, forma)} · {quiRegistre(row)}
              {row.id_incidencia ? (
                <button type="button" onClick={() => navigateTo('incidencies', { incidenciaId: row.id_incidencia })} style={{ marginLeft: 8, ...botoSecundari(colors) }}>
                  Veure incidència
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>Plans que no es dupliquen aquí</h2>
        {PLANS_JA_COBERTS.map((pla) => (
          <p key={pla.codi} style={{ margin: 0, fontSize: 14, color: colors.textSecondary }}>{pla.text}</p>
        ))}
        <p style={{ margin: 0, fontSize: 13, color: colors.textSecondary }}>
          Plans: {PLANS_HIGIENE.map((pla) => pla.etiqueta).join(' · ')}
        </p>
      </section>
    </div>
  );
}

function th(colors) {
  return {
    padding: '10px 12px',
    textAlign: 'left',
    fontSize: 12,
    textTransform: 'uppercase',
    color: colors.textSecondary,
    borderBottom: `1px solid ${colors.border}`
  };
}

function td(colors) {
  return { padding: '10px 12px', borderBottom: `1px solid ${colors.border}`, verticalAlign: 'top' };
}

function botoSecundari(colors) {
  return {
    padding: '6px 10px',
    borderRadius: 8,
    border: `0.5px solid ${colors.border}`,
    background: colors.surface,
    cursor: 'pointer'
  };
}
