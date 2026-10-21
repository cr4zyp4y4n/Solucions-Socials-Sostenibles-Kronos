import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { FIRMA_EMPRESA_INFO } from '../constants/firmaEmpresas';
import { MOMENTS_TORN } from '../../shared/obrador/checklistsTorn';

const ENTITAT = FIRMA_EMPRESA_INFO.EI_SSS.nombre;
const NIF = FIRMA_EMPRESA_INFO.EI_SSS.nif;
const ZONA = 'Europe/Madrid';

const MOMENT = Object.fromEntries(MOMENTS_TORN.map((m) => [m.id, m.label]));

const TIPUS_INC = {
  temperatura: 'Temperatura',
  qualitat: 'Qualitat',
  contaminacio: 'Contaminació',
  etiquetatge: 'Etiquetatge',
  altres: 'Altres',
  sensor_fora_rang: 'Sensor fora de rang',
  sensor_sense_senyal: 'Sensor sense senyal'
};

const TIPUS_TEMP = {
  refrigeracio: 'Refrigeració',
  congelacio: 'Congelació',
  conservacio: 'Conservació',
  zonaProduccio: 'Zona de producció'
};

const ESTAT_INC = {
  oberta: 'Oberta',
  en_curs: 'En revisió',
  tancada: 'Tancada'
};

const ESTAT_LOT = {
  produit: 'Produït',
  envasat: 'Envasat',
  expedit: 'Expedit',
  retirat: 'Retirat'
};

function text(value) {
  if (value == null || value === '') return '';
  return String(value);
}

function siNo(value) {
  if (value == null || value === '') return '';
  return value ? 'Sí' : 'No';
}

function num(value) {
  if (value == null || value === '') return '';
  const n = Number(value);
  if (Number.isNaN(n)) return text(value);
  return n.toLocaleString('ca-ES', { maximumFractionDigits: 2 });
}

function dataCurta(iso) {
  if (!iso) return '';
  const pla = String(iso).slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(pla) && String(iso).length <= 10) {
    const [y, m, d] = pla.split('-');
    return `${d}/${m}/${y}`;
  }
  return new Date(iso).toLocaleDateString('ca-ES', {
    timeZone: ZONA,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

function dataHora(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('ca-ES', {
    timeZone: ZONA,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function referenciaIncidencia(inc) {
  if (inc.origen === 'torn') return 'Registre de torn';
  if (inc.origen === 'sensor') return inc.obrador_sensors?.nom || inc.obrador_sensors?.ubicacio || 'Sensor';
  return inc.obrador_lots?.codi_lot || '';
}

function recepcionsOrigen(lot) {
  const links = [...(lot.obrador_lot_recepcions || [])].sort((a, b) => (a.ordre || 0) - (b.ordre || 0));
  return links.map((link) => {
    const recepcio = link.obrador_recepcions || {};
    const parts = [
      recepcio.obrador_proveidors?.nom || 'Proveïdor',
      recepcio.lot_proveidor || '',
      dataHora(recepcio.data_recepcio)
    ].filter(Boolean);
    return parts.join(' · ');
  }).join(' | ');
}

function itemsTorn(registre) {
  const items = Array.isArray(registre.items) ? registre.items : [];
  return items.map((item) => {
    const parts = [item.ok ? 'Sí' : 'No', item.etiqueta];
    if (item.valor) parts.push(item.valor);
    if (item.nota) parts.push(item.nota);
    return parts.filter(Boolean).join(' | ');
  }).join('\n');
}

function nomFitxer(paquet, sufix) {
  return `obrador-inspeccio_${paquet.desde}_${paquet.fins}_${sufix}`;
}

export function taulesInspeccio(paquet) {
  const registres = [...(paquet.registres || [])].sort((a, b) => {
    const perData = String(a.data).localeCompare(String(b.data));
    if (perData) return perData;
    return MOMENTS_TORN.findIndex((m) => m.id === a.moment) - MOMENTS_TORN.findIndex((m) => m.id === b.moment);
  });

  return [
    {
      id: 'recepcions',
      titol: 'Recepcions',
      nomFitxer: nomFitxer(paquet, 'recepcions.csv'),
      capcaleres: ['Data', 'Proveïdor', 'Lot proveïdor', 'Temperatura °C', 'Estat', 'Caducitat', 'Congelat', 'Operari', 'Observacions'],
      files: (paquet.recepcions || []).map((row) => [
        dataHora(row.data_recepcio),
        row.obrador_proveidors?.nom || '',
        text(row.lot_proveidor),
        num(row.temperatura_arribada),
        text(row.estat),
        dataCurta(row.caducitat),
        siNo(row.congelat),
        text(row.operari),
        text(row.observacions)
      ])
    },
    {
      id: 'lots',
      titol: 'Lots i recepcions d\'origen',
      nomFitxer: nomFitxer(paquet, 'lots.csv'),
      capcaleres: ['Codi', 'Data producció', 'Producte', 'Kg', 'Temp. cocció °C', 'Estat', 'Mostra', 'Operari', 'Recepcions d\'origen', 'Observacions'],
      files: (paquet.lots || []).map((row) => [
        text(row.codi_lot),
        dataHora(row.data_produccio),
        row.obrador_productes?.nom || '',
        num(row.quantitat_kg),
        num(row.temp_final_coccio),
        ESTAT_LOT[row.estat] || text(row.estat),
        siNo(row.mostra_guardada),
        row.obrador_operaris?.nom || '',
        recepcionsOrigen(row),
        text(row.observacions)
      ])
    },
    {
      id: 'expedicions',
      titol: 'Expedicions',
      nomFitxer: nomFitxer(paquet, 'expedicions.csv'),
      capcaleres: ['Data sortida', 'Lot', 'Producte', 'Client', 'Estat', 'Check sortida', 'OK receptor', 'Nom receptor', 'Hora OK', 'Nota receptor', 'Comanda Holded', 'Observacions', 'Anul·lada el', 'Anul·lada per', 'Motiu anul·lació'],
      files: (paquet.expedicions || []).map((row) => [
        dataHora(row.data_sortida),
        row.obrador_lots?.codi_lot || '',
        row.obrador_lots?.obrador_productes?.nom || '',
        text(row.id_client),
        row.estat === 'anulada' ? 'Anul·lada' : text(row.estat),
        siNo(row.check_sortida),
        siNo(row.check_client),
        text(row.confirmat_client_nom),
        dataHora(row.confirmat_client_at),
        text(row.confirmat_client_nota),
        text(row.comanda_holded),
        text(row.observacions),
        dataHora(row.anulada_at),
        text(row.anulada_per_nom),
        text(row.anulada_motiu)
      ])
    },
    {
      id: 'incidencies',
      titol: 'Incidències i acció correctiva',
      nomFitxer: nomFitxer(paquet, 'incidencies.csv'),
      capcaleres: ['Data', 'Origen', 'Referència', 'Tipus', 'Descripció', 'Estat', 'Acció correctiva', 'Tancada per', 'Tancada el', 'Verificada per', 'Verificada el'],
      files: (paquet.incidencies || []).map((row) => [
        dataHora(row.data_incidencia),
        row.origen === 'sensor' ? 'Sensor' : row.origen === 'torn' ? 'Torn' : 'Lot',
        referenciaIncidencia(row),
        TIPUS_INC[row.tipus] || text(row.tipus),
        text(row.descripcio),
        ESTAT_INC[row.estat] || text(row.estat),
        text(row.notes_tancament),
        text(row.tancada_per_nom),
        dataHora(row.tancada_at),
        text(row.verificada_per_nom),
        dataHora(row.verificada_at)
      ])
    },
    {
      id: 'registres',
      titol: 'Registres de torn',
      nomFitxer: nomFitxer(paquet, 'registres-torn.csv'),
      capcaleres: ['Dia', 'Moment', 'Operari', 'Registrat per', 'Quan', 'Ítems', 'No conformitat', 'Observacions'],
      files: registres.map((row) => [
        dataCurta(row.data),
        MOMENT[row.moment] || text(row.moment),
        text(row.operari_nom),
        text(row.registrat_per_nom),
        dataHora(row.created_at),
        itemsTorn(row),
        row.incidencia_detectada ? 'Sí' : 'No',
        text(row.observacions)
      ])
    },
    {
      id: 'temperatures',
      titol: 'Lectures de temperatura',
      nomFitxer: nomFitxer(paquet, 'temperatures.csv'),
      capcaleres: ['Data i hora', 'Ubicació', 'Sensor', 'Tipus', 'Valor °C', 'Humitat %'],
      files: (paquet.temperatures || []).map((row) => [
        dataHora(row.mesura_at),
        text(row.ubicacio),
        row.obrador_sensors?.nom || '',
        TIPUS_TEMP[row.tipus] || text(row.tipus),
        num(row.valor),
        num(row.humitat)
      ])
    }
  ];
}

function csvCela(value) {
  const s = text(value);
  if (/[;"\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function aCsv(capcaleres, files) {
  return [
    capcaleres.map(csvCela).join(';'),
    ...files.map((fila) => fila.map(csvCela).join(';'))
  ].join('\n');
}

function descarregarBlob(blob, nom) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nom;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function escriureLinia(doc, linia, x, y) {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(40);
  doc.text(linia, x, y);
  return y + 6;
}

export function descarregarPdfInspeccio(paquet) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const margin = 12;
  let y = 16;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(20);
  doc.text('Registres d\'inspecció de l\'obrador', margin, y);
  y += 8;

  y = escriureLinia(doc, `Entitat: ${ENTITAT}${NIF ? ` · NIF ${NIF}` : ''}`, margin, y);
  y = escriureLinia(doc, `Període exportat: ${dataCurta(paquet.desde)} - ${dataCurta(paquet.fins)}`, margin, y);
  y = escriureLinia(doc, `Data de generació: ${dataHora(paquet.generatEl)}`, margin, y);
  y = escriureLinia(doc, `Generat per: ${paquet.generatPer || '—'}`, margin, y);
  y += 2;

  const taules = taulesInspeccio(paquet);
  for (const taula of taules) {
    if (y > 175) {
      doc.addPage();
      y = 16;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(20);
    doc.text(`${taula.titol} (${taula.files.length})`, margin, y);
    y += 3;

    if (taula.id === 'temperatures' && paquet.temperaturesTruncades) {
      y += 4;
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      doc.text('S\'han inclòs les primeres 20.000 lectures. La resta no cap en aquesta exportació.', margin, y);
      y += 2;
    }

    if (!taula.files.length) {
      y += 6;
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(10);
      doc.setTextColor(80);
      doc.text('Sense registres en aquest període.', margin, y);
      y += 8;
      continue;
    }

    autoTable(doc, {
      startY: y + 2,
      head: [taula.capcaleres],
      body: taula.files,
      margin: { top: 14, left: margin, right: margin, bottom: 16 },
      styles: { fontSize: 8, cellPadding: 1.2, overflow: 'linebreak', textColor: 30 },
      headStyles: { fillColor: [45, 80, 60], textColor: 255, fontStyle: 'bold' },
      theme: 'grid'
    });
    y = doc.lastAutoTable.finalY + 10;
  }

  const total = doc.internal.getNumberOfPages();
  for (let i = 1; i <= total; i += 1) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(90);
    doc.text(`${ENTITAT} · Obrador`, margin, 202);
    doc.text(`Pàgina ${i} de ${total}`, 285, 202, { align: 'right' });
  }

  doc.save(nomFitxer(paquet, 'inspeccio.pdf'));
}

export function descarregarCsvInspeccio(paquet) {
  taulesInspeccio(paquet).forEach((taula, index) => {
    setTimeout(() => {
      const blob = new Blob(['\ufeff' + aCsv(taula.capcaleres, taula.files)], { type: 'text/csv;charset=utf-8;' });
      descarregarBlob(blob, taula.nomFitxer);
    }, index * 300);
  });
}
