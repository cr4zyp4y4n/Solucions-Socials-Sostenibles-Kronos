import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChefHat,
  ClipboardList,
  Droplet,
  Flame,
  GraduationCap,
  Moon,
  Paintbrush,
  Refrigerator,
  Rows3,
  Snowflake,
  Sunrise,
  Trash2,
  Wrench
} from 'lucide-react';
import { colors } from '../theme';
import {
  PLANS_JA_COBERTS,
  definicioRegistre,
  iniciPeriode
} from '@shared-obrador/registresHigiene';
import {
  getTipusRegistre,
  getRegistresHigieneDesDe,
  crearRegistreHigiene,
  obrirIncidenciaDeRegistre,
  nomPerCodiFichatge
} from '../services/obradorPortalService';

const ORDRE = [
  'torn_inici',
  'aigua_clor',
  'torn_produccio',
  'temperatures_equips',
  'residus_retirada',
  'torn_tancament',
  'neteja_setmanal',
  'neteja_forn',
  'neteja_mensual',
  'neteja_congelador',
  'formacio_sessio',
  'manteniment_equips'
];

const ICONES = {
  torn_inici: Sunrise,
  aigua_clor: Droplet,
  neteja_setmanal: Rows3,
  neteja_forn: Flame,
  neteja_mensual: Paintbrush,
  neteja_congelador: Refrigerator,
  torn_produccio: ChefHat,
  temperatures_equips: Snowflake,
  residus_retirada: Trash2,
  torn_tancament: Moon,
  formacio_sessio: GraduationCap,
  manteniment_equips: Wrench
};

function IconaRegistre({ codi, size = 22 }) {
  const Icona = ICONES[codi] || ClipboardList;
  return <Icona size={size} strokeWidth={2} color={colors.primary} aria-hidden="true" />;
}

const AJUDA = {
  torn_inici: 'En arribar: càmares, neteja i higiene personal.',
  aigua_clor: 'Una mostra d\'aigua de l\'obrador i el clor que has mesurat.',
  neteja_setmanal: 'Un cop aquesta setmana: prestatges, campana, neveres, cubells i magatzem.',
  neteja_forn: 'Dues vegades aquesta setmana.',
  neteja_mensual: 'Un cop aquest mes: parets altes i prestatges del magatzem.',
  neteja_congelador: 'Un cop aquest trimestre.',
  torn_produccio: 'Durant l\'elaboració.',
  temperatures_equips: 'Lectura dels equips de fred.',
  residus_retirada: 'Què s\'ha retirat avui i on ha anat.',
  torn_tancament: 'En acabar el torn.',
  formacio_sessio: 'Quan hi ha una sessió: qui ve i qui signa.',
  manteniment_equips: 'Quan un equip o la instal·lació falla.'
};

function avuiMadrid() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
}

function faDies(n) {
  const data = new Date();
  data.setDate(data.getDate() - n);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(data);
}

function textPeriode(fila, avui) {
  if (!fila) return '';
  if (fila.frequencia === 'diari') return `Dia ${formatDia(avui)}.`;
  if (fila.frequencia === 'setmanal' && fila.maxim > 1) return `Aquesta setmana, fins a ${fila.maxim} vegades.`;
  if (fila.frequencia === 'setmanal') return 'Un cop aquesta setmana.';
  if (fila.frequencia === 'mensual') return 'Un cop aquest mes.';
  if (fila.frequencia === 'trimestral') return 'Un cop aquest trimestre.';
  return 'Es pot fer més d\'una vegada.';
}

function textFet(fila) {
  if (fila?.frequencia === 'diari') return 'Ja està fet avui';
  if (fila?.frequencia === 'setmanal' && fila.maxim > 1) return 'Ja està fet aquesta setmana';
  if (fila?.frequencia === 'setmanal') return 'Ja està fet aquesta setmana';
  if (fila?.frequencia === 'mensual') return 'Ja està fet aquest mes';
  if (fila?.frequencia === 'trimestral') return 'Ja està fet aquest trimestre';
  return 'Ja està fet';
}

function formatDia(iso) {
  const [y, m, d] = String(iso || '').slice(0, 10).split('-');
  if (!y || !m || !d) return '';
  return `${d}/${m}/${y}`;
}

function resumRegistre(registre, forma) {
  const detall = registre?.detall || {};
  if (forma === 'clor') {
    return [detall.punt_mostreig, detall.nivell != null && detall.nivell !== '' ? `${detall.nivell} mg/L` : '']
      .filter(Boolean)
      .join(' · ');
  }
  if (forma === 'residus') {
    return [detall.tipus_residu, detall.quantitat, detall.desti].filter(Boolean).join(' · ');
  }
  if (forma === 'assistencia') {
    const n = Array.isArray(detall.assistents) ? detall.assistents.length : 0;
    return [detall.titol, n ? `${n} assistents` : ''].filter(Boolean).join(' · ');
  }
  if (forma === 'manteniment') {
    return [detall.equip, detall.mesura].filter(Boolean).join(' · ');
  }
  const items = Array.isArray(registre?.items) ? registre.items : [];
  const no = items.filter((item) => item.ok === false).length;
  if (!items.length) return 'Fet';
  if (no) return `${no} resposta${no === 1 ? '' : 's'} en no`;
  return 'Tot correcte';
}

const inputStyle = {
  width: '100%',
  padding: '14px 12px',
  fontSize: 16,
  borderRadius: 10,
  border: `1px solid ${colors.border}`,
  boxSizing: 'border-box',
  background: '#fff'
};

const labelStyle = {
  display: 'block',
  fontSize: 14,
  fontWeight: 700,
  marginBottom: 6
};

function BotoSiNo({ actiu, color, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1,
        minHeight: 52,
        fontSize: 18,
        fontWeight: 800,
        borderRadius: 12,
        border: `2px solid ${actiu ? color : colors.border}`,
        background: actiu ? color : '#fff',
        color: actiu ? '#fff' : colors.text,
        cursor: 'pointer'
      }}
    >
      {children}
    </button>
  );
}

export default function PlansHigienePage() {
  const avui = avuiMadrid();
  const [tipus, setTipus] = useState([]);
  const [registres, setRegistres] = useState([]);
  const [codi, setCodi] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [enviant, setEnviant] = useState(false);
  const [desat, setDesat] = useState('');
  const [respostes, setRespostes] = useState({});
  const [clor, setClor] = useState({ punt_mostreig: '', nivell: '' });
  const [residus, setResidus] = useState({ tipus_residu: '', quantitat: '', desti: '' });
  const [assistencia, setAssistencia] = useState({
    titol: '',
    contingut: '',
    imparteix: '',
    durada: '',
    assistents: [{ nom: '', signatura: '' }]
  });
  const [manteniment, setManteniment] = useState({ equip: '', incidencia: '', mesura: '' });
  const [codiFichatge, setCodiFichatge] = useState('');
  const [nomOperari, setNomOperari] = useState('');
  const [nomError, setNomError] = useState('');

  const carregar = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [tipusRows, registresRows] = await Promise.all([
        getTipusRegistre(),
        getRegistresHigieneDesDe(faDies(120))
      ]);
      setTipus(tipusRows);
      setRegistres(registresRows);
    } catch (err) {
      setError(err.message || 'No s\'han pogut carregar els plans.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const perCodi = useMemo(() => {
    const map = new Map();
    for (const row of tipus) map.set(row.codi, row);
    return map;
  }, [tipus]);

  const llista = useMemo(() => {
    const codis = ORDRE.filter((id) => perCodi.has(id));
    for (const row of tipus) {
      if (!codis.includes(row.codi) && definicioRegistre(row.codi)) codis.push(row.codi);
    }
    return codis.map((id) => {
      const meta = perCodi.get(id);
      const definicio = definicioRegistre(id);
      const frequencia = meta?.frequencia || 'diari';
      const maxim = meta?.maxim_per_periode || (meta?.unic_per_periode ? 1 : null);
      const periode = iniciPeriode(frequencia, avui);
      const delPeriode = registres.filter((row) => {
        if (row.tipus_codi !== id) return false;
        const clau = String(row.periode_inici || row.data).slice(0, 10);
        return (row.periode_inici ? clau : iniciPeriode(frequencia, clau)) === periode;
      });
      const fets = delPeriode.length;
      const diari = frequencia === 'diari';
      const fet = Boolean(maxim && fets >= maxim);
      let estat = 'Nou';
      if (definicio?.forma === 'checklist' && !(definicio.items || []).length) estat = 'Sense llista';
      else if (fet) estat = 'Fet';
      else if (maxim > 1) estat = `${fets} de ${maxim}`;
      else if (maxim === 1) estat = 'Pendent';
      return {
        codi: id,
        etiqueta: meta?.etiqueta || id,
        ajuda: AJUDA[id] || '',
        definicio,
        frequencia,
        maxim,
        diari,
        fet,
        estat,
        delDia: delPeriode[0] || null,
        buit: definicio?.forma === 'checklist' && !(definicio.items || []).length
      };
    });
  }, [perCodi, registres, tipus, avui]);

  const seleccio = llista.find((fila) => fila.codi === codi) || null;
  const recents = useMemo(() => {
    if (!codi || seleccio?.diari) return [];
    return registres.filter((row) => row.tipus_codi === codi).slice(0, 5);
  }, [codi, registres, seleccio]);

  useEffect(() => {
    const numero = codiFichatge.trim();
    if (!numero) {
      setNomOperari('');
      setNomError('');
      return undefined;
    }
    let viu = true;
    const timer = setTimeout(async () => {
      try {
        const nom = await nomPerCodiFichatge(numero);
        if (!viu) return;
        setNomOperari(nom || '');
        setNomError(nom ? '' : 'Aquest número no correspon a ningú.');
      } catch (err) {
        if (!viu) return;
        setNomOperari('');
        setNomError(err.message || 'No s\'ha pogut comprovar el número.');
      }
    }, 350);
    return () => {
      viu = false;
      clearTimeout(timer);
    };
  }, [codiFichatge]);

  function obrir(id) {
    setCodi(id);
    setError('');
    setDesat('');
    setRespostes({});
    setClor({ punt_mostreig: '', nivell: '' });
    setResidus({ tipus_residu: '', quantitat: '', desti: '' });
    setAssistencia({
      titol: '',
      contingut: '',
      imparteix: '',
      durada: '',
      assistents: [{ nom: '', signatura: '' }]
    });
    setManteniment({ equip: '', incidencia: '', mesura: '' });
    setCodiFichatge('');
    setNomOperari('');
    setNomError('');
  }

  function tornar() {
    setCodi('');
    setError('');
    setDesat('');
  }

  async function desar(detall, items, descripcioIncidencia) {
    const numero = codiFichatge.trim();
    if (!numero || !nomOperari) {
      setError(nomError || 'Escriu el número de fitxatge. Ha de correspondre a una persona.');
      return;
    }
    setEnviant(true);
    setError('');
    let registre = null;
    try {
      registre = await crearRegistreHigiene({
        tipus_codi: codi,
        data: avui,
        items: items || [],
        detall: detall || null,
        incidencia_detectada: Boolean(descripcioIncidencia),
        codi_fichatge: numero
      });
    } catch (err) {
      setError(err.message || 'No s\'ha pogut desar.');
      setEnviant(false);
      return;
    }
    if (descripcioIncidencia) {
      try {
        await obrirIncidenciaDeRegistre(registre.id, descripcioIncidencia);
      } catch (err) {
        setDesat('Registre desat');
        setError(`El registre s'ha desat. La incidència no: ${err.message || 'error'}`);
        await carregar();
        setEnviant(false);
        return;
      }
    }
    const qui = registre?.nom_operari
      ? `${registre.codi_fichatge} · ${registre.nom_operari}`
      : `${numero} · ${nomOperari}`;
    setDesat(descripcioIncidencia ? `Desat. Incidència oberta. ${qui}` : `Desat. ${qui}`);
    await carregar();
    setEnviant(false);
  }

  function enviarChecklist(ambIncidencia) {
    const items = seleccio?.definicio?.items || [];
    for (const item of items) {
      const resposta = respostes[item.clau];
      if (resposta?.ok !== true && resposta?.ok !== false) {
        setError('Cal respondre tots els punts: Sí o No.');
        return;
      }
      if (resposta.ok && item.demanaValor && !String(resposta.valor || '').trim()) {
        setError(`Escriu el valor de: ${item.etiqueta}.`);
        return;
      }
    }
    const payload = items.map((item) => ({
      clau: item.clau,
      etiqueta: item.etiqueta,
      ok: respostes[item.clau].ok,
      valor: String(respostes[item.clau].valor || '').trim() || null,
      nota: null,
      llindar: null
    }));
    let descripcio = null;
    if (ambIncidencia) {
      const linies = payload
        .filter((item) => item.ok === false)
        .map((item) => [item.etiqueta, item.valor].filter(Boolean).join(': '));
      descripcio = `No conformitat al registre ${seleccio.etiqueta} del ${formatDia(avui)}. ${linies.join('. ')}.`;
    }
    desar(null, payload, descripcio);
  }

  function enviarClor(e) {
    e.preventDefault();
    const nivell = clor.nivell.trim().replace(',', '.');
    const numero = Number(nivell);
    if (!clor.punt_mostreig.trim() || nivell === '' || Number.isNaN(numero)) {
      setError('Escriu d\'on surt l\'aigua i el clor que has mesurat.');
      return;
    }
    desar({
      punt_mostreig: clor.punt_mostreig.trim(),
      nivell: numero,
      unitat: 'mg/L',
      llindar: null
    }, []);
  }

  function enviarResidus(e) {
    e.preventDefault();
    if (!residus.tipus_residu.trim() || !residus.quantitat.trim() || !residus.desti.trim()) {
      setError('Cal el tipus, la quantitat i el destí.');
      return;
    }
    desar({
      tipus_residu: residus.tipus_residu.trim(),
      quantitat: residus.quantitat.trim(),
      desti: residus.desti.trim()
    }, []);
  }

  function enviarAssistencia(e) {
    e.preventDefault();
    const assistents = assistencia.assistents
      .map((fila) => ({ nom: fila.nom.trim(), signatura: fila.signatura.trim() }))
      .filter((fila) => fila.nom);
    if (!assistencia.titol.trim() || !assistencia.contingut.trim() || !assistencia.imparteix.trim()) {
      setError('Cal el títol, què s\'ha explicat i qui ho imparteix.');
      return;
    }
    if (!assistents.length || assistents.some((fila) => !fila.signatura)) {
      setError('Cada persona ha de posar el nom i la signatura.');
      return;
    }
    desar({
      titol: assistencia.titol.trim(),
      contingut: assistencia.contingut.trim(),
      imparteix: assistencia.imparteix.trim(),
      durada: assistencia.durada.trim() || null,
      assistents
    }, []);
  }

  function enviarManteniment(e) {
    e.preventDefault();
    if (!manteniment.equip.trim() || manteniment.incidencia.trim().length < 10 || !manteniment.mesura.trim()) {
      setError('Cal l\'equip, què ha passat (mínim 10 lletres) i què heu fet.');
      return;
    }
    const descripcio = `Manteniment de ${manteniment.equip.trim()}. ${manteniment.incidencia.trim()} Mesura: ${manteniment.mesura.trim()}.`;
    desar({
      equip: manteniment.equip.trim(),
      incidencia: manteniment.incidencia.trim(),
      mesura: manteniment.mesura.trim()
    }, [], descripcio);
  }

  if (!codi) {
    const diaris = llista.filter((fila) => fila.frequencia === 'diari');
    const setmanals = llista.filter((fila) => fila.frequencia === 'setmanal' && !(fila.maxim > 1));
    const duesVegades = llista.filter((fila) => fila.frequencia === 'setmanal' && fila.maxim > 1);
    const mensuals = llista.filter((fila) => fila.frequencia === 'mensual');
    const trimestrals = llista.filter((fila) => fila.frequencia === 'trimestral');
    const events = llista.filter((fila) => !['diari', 'setmanal', 'mensual', 'trimestral'].includes(fila.frequencia));
    return (
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '16px 16px 32px' }}>
        <h1 style={{ margin: '0 0 6px', fontSize: 24 }}>Plans d&apos;higiene</h1>
        <p style={{ margin: '0 0 16px', color: colors.textSecondary, fontSize: 15, lineHeight: 1.45 }}>
          Avui {formatDia(avui)}. Omple el que toca. El que ja està fet queda en verd.
        </p>
        {error ? <p style={{ color: colors.error, fontWeight: 700 }}>{error}</p> : null}
        {loading ? <p style={{ color: colors.textSecondary }}>Carregant…</p> : null}
        <Grup titol="Cada dia" files={diaris} onObrir={obrir} />
        <Grup titol="Cada setmana" files={setmanals} onObrir={obrir} />
        <Grup titol="Dues vegades per setmana" files={duesVegades} onObrir={obrir} />
        <Grup titol="Cada mes" files={mensuals} onObrir={obrir} />
        <Grup titol="Cada trimestre" files={trimestrals} onObrir={obrir} />
        <Grup titol="Quan calgui" files={events} onObrir={obrir} />
        <section style={{ marginTop: 8 }}>
          <h2 style={{ fontSize: 13, letterSpacing: '0.04em', textTransform: 'uppercase', color: colors.textSecondary }}>
            Ja es fa en un altre lloc
          </h2>
          {PLANS_JA_COBERTS.map((pla) => (
            <p key={pla.codi} style={{ margin: '0 0 10px', fontSize: 13, lineHeight: 1.45, color: colors.textSecondary }}>
              {pla.text}
            </p>
          ))}
        </section>
      </div>
    );
  }

  const forma = seleccio?.definicio?.forma;
  const items = seleccio?.definicio?.items || [];
  const hiHaNo = items.some((item) => respostes[item.clau]?.ok === false);

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '12px 16px 40px' }}>
      <button
        type="button"
        onClick={tornar}
        style={{
          padding: '8px 0 12px',
          border: 'none',
          background: 'none',
          color: colors.primary,
          fontWeight: 700,
          fontSize: 16,
          cursor: 'pointer'
        }}
      >
        ← Tornar
      </button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <IconaRegistre codi={codi} size={28} />
        <h1 style={{ margin: 0, fontSize: 24 }}>{seleccio?.etiqueta}</h1>
      </div>
      <p style={{ margin: '0 0 16px', color: colors.textSecondary, fontSize: 15, lineHeight: 1.45 }}>
        {seleccio?.ajuda} {textPeriode(seleccio, avui)}
      </p>
      {error ? <p style={{ color: colors.error, fontWeight: 700 }}>{error}</p> : null}
      {desat ? (
        <div style={{
          padding: 16,
          borderRadius: 12,
          background: `${colors.success}18`,
          border: `1px solid ${colors.success}`,
          marginBottom: 16
        }}>
          <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: colors.success }}>{desat}</p>
          <button
            type="button"
            onClick={tornar}
            style={{
              marginTop: 12,
              minHeight: 48,
              padding: '0 16px',
              borderRadius: 10,
              border: 'none',
              background: colors.primary,
              color: '#fff',
              fontWeight: 800,
              fontSize: 16,
              cursor: 'pointer'
            }}
          >
            Tornar a la llista
          </button>
        </div>
      ) : null}

      {seleccio?.fet && !desat ? (
        <div style={{
          padding: 16,
          borderRadius: 12,
          background: '#fff',
          border: `1px solid ${colors.border}`
        }}>
          <p style={{ margin: '0 0 8px', fontWeight: 800, color: colors.success }}>{textFet(seleccio)}</p>
          <p style={{ margin: 0, fontSize: 16, lineHeight: 1.45 }}>
            {resumRegistre(seleccio.delDia, forma) || 'Registrat'}
          </p>
          {seleccio.delDia?.nom_operari ? (
            <p style={{ margin: '8px 0 0', fontSize: 16, fontWeight: 800 }}>
              {seleccio.delDia.codi_fichatge} · {seleccio.delDia.nom_operari}
            </p>
          ) : null}
        </div>
      ) : null}

      {!desat && !seleccio?.fet && seleccio?.buit ? (
        <p style={{
          margin: 0,
          padding: 16,
          borderRadius: 12,
          background: '#fff',
          border: `1px solid ${colors.border}`,
          lineHeight: 1.5
        }}>
          {seleccio.definicio.buit}
        </p>
      ) : null}

      {!desat && !seleccio?.fet && !seleccio?.buit && forma === 'checklist' ? (
        <div>
          {items.map((item) => {
            const resposta = respostes[item.clau] || {};
            return (
              <div key={item.clau} style={{
                marginBottom: 12,
                padding: 14,
                borderRadius: 12,
                background: '#fff',
                border: `1px solid ${colors.border}`
              }}>
                <p style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, lineHeight: 1.35 }}>{item.etiqueta}</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <BotoSiNo
                    actiu={resposta.ok === true}
                    color={colors.success}
                    onClick={() => setRespostes((prev) => ({ ...prev, [item.clau]: { ...resposta, ok: true } }))}
                  >
                    Sí
                  </BotoSiNo>
                  <BotoSiNo
                    actiu={resposta.ok === false}
                    color={colors.error}
                    onClick={() => setRespostes((prev) => ({ ...prev, [item.clau]: { ...resposta, ok: false, valor: '' } }))}
                  >
                    No
                  </BotoSiNo>
                </div>
                {item.demanaValor && resposta.ok === true ? (
                  <label style={{ ...labelStyle, marginTop: 12 }}>
                    Valor llegit
                    <input
                      style={{ ...inputStyle, marginTop: 6 }}
                      inputMode="decimal"
                      value={resposta.valor || ''}
                      onChange={(e) => setRespostes((prev) => ({
                        ...prev,
                        [item.clau]: { ...resposta, valor: e.target.value }
                      }))}
                    />
                  </label>
                ) : null}
              </div>
            );
          })}
          <CampFichatge codi={codiFichatge} nom={nomOperari} avis={nomError} onChange={setCodiFichatge} />
          <button
            type="button"
            disabled={enviant}
            onClick={() => enviarChecklist(false)}
            style={botoPrimari}
          >
            {enviant ? 'Desant…' : 'Desar registre'}
          </button>
          {hiHaNo ? (
            <button
              type="button"
              disabled={enviant}
              onClick={() => enviarChecklist(true)}
              style={{ ...botoPrimari, background: colors.warning, marginTop: 8 }}
            >
              Desar i obrir incidència
            </button>
          ) : null}
        </div>
      ) : null}

      {!desat && !seleccio?.fet && forma === 'clor' ? (
        <form onSubmit={enviarClor}>
          <label style={labelStyle}>
            D&apos;on surt l&apos;aigua
            <input
              style={{ ...inputStyle, marginTop: 6 }}
              value={clor.punt_mostreig}
              placeholder="Per exemple, aixeta de l'obrador"
              onChange={(e) => setClor((prev) => ({ ...prev, punt_mostreig: e.target.value }))}
            />
          </label>
          <label style={{ ...labelStyle, marginTop: 14 }}>
            Clor lliure residual (mg/L)
            <input
              style={{ ...inputStyle, marginTop: 6 }}
              inputMode="decimal"
              value={clor.nivell}
              onChange={(e) => setClor((prev) => ({ ...prev, nivell: e.target.value }))}
            />
          </label>
          <p style={{ fontSize: 13, color: colors.textSecondary }}>
            S&apos;anota el número mesurat. No es compara amb cap límit.
          </p>
          <CampFichatge codi={codiFichatge} nom={nomOperari} avis={nomError} onChange={setCodiFichatge} />
          <button type="submit" disabled={enviant} style={botoPrimari}>
            {enviant ? 'Desant…' : 'Desar'}
          </button>
        </form>
      ) : null}

      {!desat && !seleccio?.fet && forma === 'residus' ? (
        <form onSubmit={enviarResidus}>
          <Camp text="Tipus de residu" value={residus.tipus_residu} onChange={(v) => setResidus((p) => ({ ...p, tipus_residu: v }))} />
          <Camp text="Quantitat o contenidors" value={residus.quantitat} onChange={(v) => setResidus((p) => ({ ...p, quantitat: v }))} />
          <Camp text="On ha anat" value={residus.desti} onChange={(v) => setResidus((p) => ({ ...p, desti: v }))} />
          <CampFichatge codi={codiFichatge} nom={nomOperari} avis={nomError} onChange={setCodiFichatge} />
          <button type="submit" disabled={enviant} style={botoPrimari}>
            {enviant ? 'Desant…' : 'Desar'}
          </button>
        </form>
      ) : null}

      {!desat && forma === 'assistencia' ? (
        <form onSubmit={enviarAssistencia}>
          <Camp text="Títol de la sessió" value={assistencia.titol} onChange={(v) => setAssistencia((p) => ({ ...p, titol: v }))} />
          <label style={{ ...labelStyle, marginTop: 14 }}>
            Què s&apos;ha explicat
            <textarea
              style={{ ...inputStyle, marginTop: 6, minHeight: 96 }}
              value={assistencia.contingut}
              onChange={(e) => setAssistencia((p) => ({ ...p, contingut: e.target.value }))}
            />
          </label>
          <Camp text="Qui ho imparteix" value={assistencia.imparteix} onChange={(v) => setAssistencia((p) => ({ ...p, imparteix: v }))} />
          <Camp text="Durada (opcional)" value={assistencia.durada} onChange={(v) => setAssistencia((p) => ({ ...p, durada: v }))} />
          <p style={{ ...labelStyle, marginTop: 16 }}>Qui ha vingut</p>
          {assistencia.assistents.map((fila, index) => (
            <div key={index} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <input
                style={inputStyle}
                placeholder="Nom"
                value={fila.nom}
                onChange={(e) => setAssistencia((prev) => {
                  const assistents = prev.assistents.slice();
                  assistents[index] = { ...fila, nom: e.target.value };
                  return { ...prev, assistents };
                })}
              />
              <input
                style={inputStyle}
                placeholder="Signatura"
                value={fila.signatura}
                onChange={(e) => setAssistencia((prev) => {
                  const assistents = prev.assistents.slice();
                  assistents[index] = { ...fila, signatura: e.target.value };
                  return { ...prev, assistents };
                })}
              />
            </div>
          ))}
          <button
            type="button"
            onClick={() => setAssistencia((prev) => ({
              ...prev,
              assistents: prev.assistents.concat({ nom: '', signatura: '' })
            }))}
            style={{ ...botoSecundari, marginBottom: 12 }}
          >
            Afegir persona
          </button>
          <CampFichatge codi={codiFichatge} nom={nomOperari} avis={nomError} onChange={setCodiFichatge} />
          <button type="submit" disabled={enviant} style={botoPrimari}>
            {enviant ? 'Desant…' : 'Desar sessió'}
          </button>
          <Recents files={recents} forma={forma} />
        </form>
      ) : null}

      {!desat && forma === 'manteniment' ? (
        <form onSubmit={enviarManteniment}>
          <Camp text="Equip o instal·lació" value={manteniment.equip} onChange={(v) => setManteniment((p) => ({ ...p, equip: v }))} />
          <label style={{ ...labelStyle, marginTop: 14 }}>
            Què ha passat
            <textarea
              style={{ ...inputStyle, marginTop: 6, minHeight: 96 }}
              value={manteniment.incidencia}
              onChange={(e) => setManteniment((p) => ({ ...p, incidencia: e.target.value }))}
            />
          </label>
          <Camp text="Què heu fet" value={manteniment.mesura} onChange={(v) => setManteniment((p) => ({ ...p, mesura: v }))} />
          <CampFichatge codi={codiFichatge} nom={nomOperari} avis={nomError} onChange={setCodiFichatge} />
          <p style={{ fontSize: 13, color: colors.textSecondary }}>
            En desar s&apos;obre una incidència. Es tanca després des de Kronos.
          </p>
          <button type="submit" disabled={enviant} style={botoPrimari}>
            {enviant ? 'Desant…' : 'Desar i obrir incidència'}
          </button>
          <Recents files={recents} forma={forma} />
        </form>
      ) : null}
    </div>
  );
}

const botoPrimari = {
  width: '100%',
  minHeight: 52,
  marginTop: 8,
  border: 'none',
  borderRadius: 12,
  background: colors.primary,
  color: '#fff',
  fontSize: 18,
  fontWeight: 800,
  cursor: 'pointer'
};

const botoSecundari = {
  width: '100%',
  minHeight: 48,
  borderRadius: 12,
  border: `1px solid ${colors.border}`,
  background: '#fff',
  fontSize: 16,
  fontWeight: 700,
  cursor: 'pointer'
};

function Camp({ text, value, onChange }) {
  return (
    <label style={{ ...labelStyle, marginTop: 14 }}>
      {text}
      <input style={{ ...inputStyle, marginTop: 6 }} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function CampFichatge({ codi, nom, avis, onChange }) {
  return (
    <label style={{ ...labelStyle, marginTop: 16 }}>
      Número de fitxatge
      <input
        style={{ ...inputStyle, marginTop: 6 }}
        inputMode="numeric"
        autoComplete="off"
        value={codi}
        onChange={(e) => onChange(e.target.value)}
      />
      {nom ? (
        <span style={{ display: 'block', marginTop: 8, fontSize: 18, fontWeight: 800, color: colors.success }}>
          {codi.trim()} · {nom}
        </span>
      ) : null}
      {avis ? (
        <span style={{ display: 'block', marginTop: 8, fontSize: 14, fontWeight: 700, color: colors.error }}>
          {avis}
        </span>
      ) : null}
    </label>
  );
}

function Grup({ titol, files, onObrir }) {
  if (!files.length) return null;
  return (
    <section style={{ marginBottom: 18 }}>
      <h2 style={{ margin: '0 0 8px', fontSize: 13, letterSpacing: '0.04em', textTransform: 'uppercase', color: colors.textSecondary }}>
        {titol}
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {files.map((fila) => (
          <button
            key={fila.codi}
            type="button"
            onClick={() => onObrir(fila.codi)}
            style={{
              textAlign: 'left',
              padding: '14px 14px',
              borderRadius: 12,
              border: `1px solid ${fila.fet ? colors.success : colors.border}`,
              background: '#fff',
              cursor: 'pointer'
            }}
          >
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <span style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: `${colors.primary}16`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <IconaRegistre codi={fila.codi} />
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
                  <span style={{ fontSize: 17, fontWeight: 800 }}>{fila.etiqueta}</span>
                  <span style={{
                    fontSize: 13,
                    fontWeight: 800,
                    color: fila.fet
                      ? colors.success
                      : fila.estat === 'Pendent' || fila.estat === 'Sense llista' || String(fila.estat).includes(' de ')
                        ? colors.warning
                        : colors.textSecondary,
                    whiteSpace: 'nowrap'
                  }}>
                    {fila.estat}
                  </span>
                </span>
                {fila.ajuda ? (
                  <span style={{ display: 'block', marginTop: 4, fontSize: 14, color: colors.textSecondary, lineHeight: 1.35 }}>{fila.ajuda}</span>
                ) : null}
              </span>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

function Recents({ files, forma }) {
  if (!files.length) return null;
  return (
    <section style={{ marginTop: 20 }}>
      <h2 style={{ fontSize: 13, letterSpacing: '0.04em', textTransform: 'uppercase', color: colors.textSecondary }}>
        Darrers
      </h2>
      {files.map((fila) => (
        <p key={fila.id} style={{ margin: '0 0 8px', fontSize: 14, lineHeight: 1.4 }}>
          <strong>{formatDia(fila.data)}</strong>
          {' · '}
          {resumRegistre(fila, forma) || 'Fet'}
        </p>
      ))}
    </section>
  );
}
