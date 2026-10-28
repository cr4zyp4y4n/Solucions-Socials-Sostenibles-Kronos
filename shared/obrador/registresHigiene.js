/**
 * Metadades de pantalla dels registres d'higiene.
 * La llista d'ítems viu aquí, no a la base de dades.
 * llindar és el lloc buit: l'empresa d'APPCC encara no ha fixat cap límit.
 */
import { CHECKLISTS_TORN } from './checklistsTorn.js';

export const PLANS_HIGIENE = [
  { codi: 'control_aigua', etiqueta: "Control de l'aigua" },
  { codi: 'neteja', etiqueta: 'Neteja i desinfecció' },
  { codi: 'formacio', etiqueta: 'Formació del personal' },
  { codi: 'proveidors', etiqueta: 'Control de proveïdors' },
  { codi: 'temperatures', etiqueta: 'Control de temperatures' },
  { codi: 'residus', etiqueta: 'Gestió de residus' },
  { codi: 'manteniment', etiqueta: 'Manteniment' },
  { codi: 'torn', etiqueta: 'Registre de torn' }
];

function itemsChecklist(llista) {
  return (llista || []).map((item) => ({ ...item, llindar: null }));
}

export const DEFINICIO_REGISTRE = {
  torn_inici: {
    forma: 'checklist',
    items: itemsChecklist(CHECKLISTS_TORN.inici)
  },
  torn_produccio: {
    forma: 'checklist',
    items: itemsChecklist(CHECKLISTS_TORN.produccio)
  },
  torn_tancament: {
    forma: 'checklist',
    items: itemsChecklist(CHECKLISTS_TORN.tancament)
  },
  aigua_clor: {
    forma: 'clor'
  },
  neteja_cuina: {
    forma: 'checklist',
    items: [],
    buit: 'La neteja diària de superfícies va amb el torn. La neteja a fons és setmanal, mensual o trimestral.'
  },
  neteja_setmanal: {
    forma: 'checklist',
    items: itemsChecklist([
      { clau: 'prestatges_cuina', etiqueta: 'Prestatges de la cuina' },
      { clau: 'campana', etiqueta: 'Campana extractora' },
      { clau: 'neveres', etiqueta: 'Neveres per dins' },
      { clau: 'cubells', etiqueta: 'Cubells de deixalles' },
      { clau: 'magatzem', etiqueta: 'Prestatges i terra del magatzem' }
    ])
  },
  neteja_forn: {
    forma: 'checklist',
    items: itemsChecklist([
      { clau: 'forn', etiqueta: 'Forn' }
    ])
  },
  neteja_mensual: {
    forma: 'checklist',
    items: itemsChecklist([
      { clau: 'parets_cuina', etiqueta: 'Parets altes de la cuina' },
      { clau: 'parets_magatzem', etiqueta: 'Parets altes del magatzem' },
      { clau: 'prestatges_magatzem', etiqueta: 'Prestatges del magatzem' }
    ])
  },
  neteja_congelador: {
    forma: 'checklist',
    items: itemsChecklist([
      { clau: 'congelador', etiqueta: 'Congelador' }
    ])
  },
  temperatures_equips: {
    forma: 'checklist',
    items: [],
    buit: 'La llista d\'equips de fred es deixa buida fins a tenir els equips del local. La lectura del sensor i la manual han d\'acabar en aquest mateix registre quan la llista existeixi.'
  },
  formacio_sessio: { forma: 'assistencia' },
  residus_retirada: { forma: 'residus' },
  manteniment_equips: { forma: 'manteniment' }
};

export const PLANS_JA_COBERTS = [
  {
    codi: 'proveidors',
    text: 'El control de proveïdors és la recepció de matèries primeres. Ja es registra a Recepcions. Si l\'empresa d\'APPCC demana a més una revisió periòdica del proveïdor, caldrà un segon registre.'
  },
  {
    codi: 'coccio',
    text: 'La temperatura de cocció es registra al lot, es contrasta amb la fitxa del producte i bloqueja si no hi arriba. No es duplica aquí.'
  },
  {
    codi: 'plagues',
    text: 'El control de plagues el porta una empresa externa. El registre ja té lloc per a un origen extern i un document adjunt. Encara no s\'hi carrega res.'
  }
];

export function definicioRegistre(codi) {
  return DEFINICIO_REGISTRE[codi] || null;
}

export function etiquetaPla(codi) {
  return PLANS_HIGIENE.find((pla) => pla.codi === codi)?.etiqueta || codi;
}

function dilluns(dia) {
  const [y, m, d] = dia.split('-').map(Number);
  const data = new Date(Date.UTC(y, m - 1, d));
  const weekday = data.getUTCDay();
  const delta = weekday === 0 ? 6 : weekday - 1;
  data.setUTCDate(data.getUTCDate() - delta);
  return data.toISOString().slice(0, 10);
}

export function sumarDies(iso, n) {
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  const data = new Date(Date.UTC(y, m - 1, d));
  data.setUTCDate(data.getUTCDate() + n);
  return data.toISOString().slice(0, 10);
}

export function iniciPeriode(frequencia, iso) {
  const dia = String(iso || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) return dia;
  if (frequencia === 'setmanal') return dilluns(dia);
  if (frequencia === 'mensual') return `${dia.slice(0, 8)}01`;
  if (frequencia === 'trimestral') {
    const mes = Number(dia.slice(5, 7));
    const inici = Math.floor((mes - 1) / 3) * 3 + 1;
    return `${dia.slice(0, 5)}${String(inici).padStart(2, '0')}-01`;
  }
  return dia;
}

export function periodesEnMes(mes, frequencia) {
  const [y, m] = String(mes || '').split('-').map(Number);
  if (!y || !m) return [];
  const mm = String(m).padStart(2, '0');
  if (frequencia === 'mensual') return [`${y}-${mm}-01`];
  if (frequencia === 'trimestral') return [iniciPeriode('trimestral', `${y}-${mm}-01`)];
  if (frequencia === 'setmanal') {
    const ultim = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const primer = iniciPeriode('setmanal', `${y}-${mm}-01`);
    const darrer = iniciPeriode('setmanal', `${y}-${mm}-${String(ultim).padStart(2, '0')}`);
    const periodes = [];
    for (let cursor = primer; cursor <= darrer; cursor = sumarDies(cursor, 7)) {
      periodes.push(cursor);
    }
    return periodes;
  }
  return [];
}
