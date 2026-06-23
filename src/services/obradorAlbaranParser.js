/**

 * Parser d'albarans (text OCR) → borrador de recepció Obrador.

 * OCR únic (Tesseract); parsers per format de document.

 */



const BEGUDES_MARKERS = [/BEGUDES\s+DEL\s+VALLES/i, /\bA59801696\b/i];

const MULTIEMBALAJES_MARKERS = [
  /MULTIEMBALAJES/i,
  /multiivalles\.com/i,
  /SANTA\s+PERPETUA\s+DE\s+MOGODA/i,
  /GUIFRE\s+EL\s+PILOS/i,
  /\bB[-\s]?62835723\b/i,
  /\bESB62835723\b/i
];

const SSS_CLIENT_CIF = 'F67499186';

const CIF_PATTERN = /\b([A-Z]\d{8})\b/g;

const DATE_PATTERN = /\b(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})\b/;

const SPANISH_CP = /^(0[1-9]|[1-4]\d|5[0-2])\d{3}$/;



function normalizeText(text) {

  return String(text || '')

    .replace(/\r/g, '\n')

    .replace(/[ \t]+/g, ' ')

    .trim();

}



function linesOf(text) {

  return normalizeText(text)

    .split('\n')

    .map((l) => l.trim())

    .filter(Boolean);

}



function stripAccents(s) {

  return String(s || '')

    .toLowerCase()

    .normalize('NFD')

    .replace(/\p{M}/gu, '');

}



function isLikelyPostalCode(value) {

  return SPANISH_CP.test(String(value || '').trim());

}



function isBegudesFormat(text) {

  return BEGUDES_MARKERS.some((re) => re.test(text));

}



function isMultiembalajesFormat(text) {

  return MULTIEMBALAJES_MARKERS.some((re) => re.test(text));

}



function normalizeProveidorCif(raw) {

  const c = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

  if (/^ESB\d{8}$/.test(c)) return `B${c.slice(3)}`;

  if (/^B\d{8}$/.test(c)) return c;

  if (/^[A-Z]\d{8}$/.test(c)) return c;

  return '';

}



/** Extracció genèrica (fallback per qualsevol proveïdor). */

export function parseGenericAlbaran(text) {

  const normalized = normalizeText(text);

  const lines = linesOf(text);

  const result = {

    parserId: 'generic',

    confiança: 'baixa',

    proveidorNom: '',

    proveidorCif: '',

    lotProveidor: '',

    dataDocument: '',

    linies: [],

    notes: []

  };



  const cifs = [...normalized.matchAll(CIF_PATTERN)].map((m) => m[1]);

  if (cifs.length) {

    result.proveidorCif = cifs.find((c) =>

      c !== SSS_CLIENT_CIF && (c.startsWith('A') || c.startsWith('B'))

    ) || cifs.find((c) => c !== SSS_CLIENT_CIF) || cifs[0];

  }



  for (const pattern of [

    /albar[aá]n[:\s]*n[úu]m\.?\s*([A-Z0-9\-]+)/i,

    /alba\.?\s*[:\s]*([0-9]{4,})/i,

    /\balbar[aá]n\s+([0-9]{4,})/i,

    /ref(?:erencia)?\.?\s*[:\s]*([A-Z0-9\-]+)/i

  ]) {

    const m = normalized.match(pattern);

    if (m?.[1] && !isLikelyPostalCode(m[1])) {

      result.lotProveidor = m[1].trim();

      break;

    }

  }



  if (!result.lotProveidor) {

    for (const line of lines) {

      if (/albar|alba\b|ref\./i.test(line)) {

        const nums = line.match(/\b\d{5,}\b/g);

        const candidate = nums?.find((n) => !isLikelyPostalCode(n));

        if (candidate) {

          result.lotProveidor = candidate;

          break;

        }

      }

    }

  }



  const dateMatch = normalized.match(DATE_PATTERN);

  if (dateMatch) result.dataDocument = dateMatch[1];



  for (const line of lines.slice(0, 8)) {

    if (/\b(S\.?L\.?|S\.?A\.?|S\.?C\.?C\.?L\.?)\b/i.test(line) && line.length > 8 && line.length < 120) {

      const cleaned = line.replace(/SOLUCIONS\s+SOCIALS.*/i, '').trim();

      if (cleaned.length > 4) {

        result.proveidorNom = cleaned.split(/\s{2,}/)[0].trim();

        break;

      }

    }

  }



  if (result.proveidorNom || result.lotProveidor || result.proveidorCif) {

    result.confiança = 'mitjana';

  }



  return result;

}



const BEGUDES_LINIA_RE =
  /^(\d{5,6})\s+(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})\s+(\d{4,6})\s+(.+)/i;

function normalizeNumStr(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  if (s.startsWith(',') || s.startsWith('.')) return `0${s}`;
  return s;
}

function toNum(s) {
  if (!s) return NaN;
  return Number(normalizeNumStr(s).replace(/\./g, '').replace(',', '.'));
}

function parseBegudesTrailingColumns(afterQty) {
  const tail = String(afterQty || '').trim();
  if (!tail) return {};

  const nums = (tail.match(/(?:\d+)?[.,]\d+|\d+/g) || []).map(normalizeNumStr);
  if (nums.length < 4) return {};

  const last = (n) => nums[nums.length - n];

  const importe = last(1);
  const iva = last(2);
  const total = last(3);
  const precioUnitario = last(4);

  const ivaNum = toNum(iva);
  const looksLikeIva = !Number.isNaN(ivaNum) && ivaNum >= 0 && ivaNum <= 30;
  if (!looksLikeIva) return {};

  // Si hay 6+ números, asumimos DTO: [peso, precioUnit, dto, total, iva, importe]
  if (nums.length >= 6) {
    return {
      peso: last(6),
      precioUnitario: last(5),
      dto: last(4),
      total,
      iva,
      importe
    };
  }

  // Si hay 5 números, asumimos: [peso, precioUnit, total, iva, importe]
  if (nums.length === 5) {
    return {
      peso: last(5),
      precioUnitario,
      total,
      iva,
      importe
    };
  }

  // Si hay 4 números: [precioUnit, total, iva, importe]
  return {
    precioUnitario,
    total,
    iva,
    importe
  };
}



function parseBegudesLinia(line) {

  const m = line.match(BEGUDES_LINIA_RE);

  if (!m || /^(ALBA|FECHA|-----)/i.test(line)) return null;



  const rest = m[4];

  const qty = rest.match(/(\d+)\s+Caj\b/i);
  const cols = qty
    ? parseBegudesTrailingColumns(rest.slice((qty.index || 0) + qty[0].length))
    : {};

  return {

    albaNum: m[1],

    codi: m[3],

    descripcio: rest.replace(/\s+\d+\s+Caj.*$/i, '').trim(),

    quantitat: qty ? qty[1] : '',

    unitat: qty ? 'Caj' : '',
    dataAlbara: m[2],
    ...cols

  };

}



/** Parser Begudes del Vallès (format tipus BGRUP). */

export function parseBegudesAlbaran(text) {

  const lines = linesOf(text);

  const normalized = normalizeText(text);

  const result = {

    parserId: 'begudes',

    confiança: 'alta',

    proveidorNom: 'Begudes del Vallès',

    proveidorCif: 'A59801696',

    lotProveidor: '',

    dataDocument: '',

    numFactura: '',

    linies: [],

    notes: []

  };



  const cifFooter = normalized.match(/C\.?I\.?F\.?:\s*([A-Z]\d{8})/i);

  if (cifFooter) result.proveidorCif = cifFooter[1];



  const headerLine = lines.find((l) =>

    /^\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}\s+\d{1,2}\s+\d{10,}/.test(l)

  );

  if (headerLine) {

    const hm = headerLine.match(

      /^(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})\s+\d+\s+(\d{10,})/

    );

    if (hm) {

      result.dataDocument = hm[1];

      result.numFactura = hm[2];

    }

  }



  const albaNums = [];
  let currentDataAlbara = '';
  let currentAlbaNum = '';

  for (const line of lines) {
    const parsed = parseBegudesLinia(line);

    if (parsed) {
      currentDataAlbara = parsed.dataAlbara || currentDataAlbara;
      currentAlbaNum = parsed.albaNum || currentAlbaNum;
      albaNums.push(parsed.albaNum);
      result.linies.push({
        codi: parsed.codi,
        descripcio: parsed.descripcio,
        quantitat: parsed.quantitat,
        unitat: parsed.unitat,
        dataAlbara: parsed.dataAlbara
      });
      continue;
    }

    // Línies de producte "continuació" (sense capçalera d'albarà):
    // Ex: "02409 *JUVER ... 2 Caj ..."
    if (currentDataAlbara) {
      const cm = line.match(/^(\d{4,6})\s+(.+)/i);
      if (cm && !/^(ALBA|FECHA|-----)/i.test(line)) {
        const rest = cm[2];
        const qty = rest.match(/(\d+)\s+Caj\b/i);
        const cols = qty
          ? parseBegudesTrailingColumns(rest.slice((qty.index || 0) + qty[0].length))
          : {};
        if (qty) {
          result.linies.push({
            codi: cm[1],
            descripcio: rest.replace(/\s+\d+\s+Caj.*$/i, '').trim(),
            quantitat: qty[1],
            unitat: 'Caj',
            dataAlbara: currentDataAlbara,
            albaNum: currentAlbaNum,
            ...cols
          });
        }
      }
    }
  }



  if (!result.linies.length) {

    const globalRe = /\b(\d{5,6})\s+(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})\s+(\d{4,6})\s+([^0-9*][^\n]{3,}?)\s+(\d+)\s+Caj\b/gi;

    let gm;

    while ((gm = globalRe.exec(normalized)) !== null) {

      albaNums.push(gm[1]);

      result.linies.push({

        codi: gm[3],

        descripcio: gm[4].trim(),

        quantitat: gm[5],

        unitat: 'Caj',

        dataAlbara: gm[2]

      });

    }

  }



  // En BGRUP, el camp que es vol com "nº albarà" és el Nº factura.
  if (result.numFactura) {
    result.lotProveidor = result.numFactura;
  } else if (albaNums.length) {
    result.lotProveidor = [...new Set(albaNums)].join(', ');
  }



  if (!result.linies.length) result.confiança = 'mitjana';



  return result;

}



const MULTIEMBALAJES_CODI_RE = /^(?=[A-Z0-9]*\d)(?=[A-Z0-9]*[A-Z])([A-Z0-9]{8,12})\b/i;



function parseMultiembalajesTrailing(rest) {

  let tail = String(rest || '')

    .replace(/\|/g, ' ')

    .replace(/\]/g, ' ')

    .replace(/%/g, ' ')

    .replace(/\s+/g, ' ')

    .trim();



  const amounts = tail.match(/\d+[.,]\d{2}/g) || [];

  if (!amounts.length) return { descripcio: tail, quantitat: '', unitat: '', importe: '' };



  const importe = amounts[amounts.length - 1];

  let before = tail.slice(0, tail.lastIndexOf(importe)).trim();



  before = before.replace(/(?:\d{3,}\s*){1,3}$/, '').trim();



  const weirdPair = before.match(/(\d{3,})\s+(\d+[.,]\d{2})\s*$/);

  if (weirdPair) {

    return {

      descripcio: before.slice(0, weirdPair.index).trim(),

      quantitat: weirdPair[2].replace(',', '.'),

      importe

    };

  }



  const amounts2 = before.match(/\d+[.,]\d{2}/g) || [];

  if (amounts2.length) {

    const precio = amounts2[amounts2.length - 1];

    before = before.slice(0, before.lastIndexOf(precio)).trim();

  }



  const pair = before.match(/(\d+(?:[.,]\d+)?)\s+(\d+(?:[.,]\d+)?)\s*$/);

  if (pair) {

    return {

      descripcio: before.slice(0, pair.index).trim(),

      quantitat: pair[1].replace(',', '.'),

      unitat: pair[2],

      importe

    };

  }



  const single = before.match(/(\d+(?:[.,]\d+)?)\s*$/);

  if (single) {

    return {

      descripcio: before.slice(0, single.index).trim(),

      quantitat: single[1].replace(',', '.'),

      importe

    };

  }



  return { descripcio: before, importe };

}



function parseMultiembalajesLinia(line) {

  if (/^(NUMERO|FECHA|CANT|TOTAL|CAJAS|PALLETS|REGISTRO|HORARI|e-Mail|Tel[eé]fono|\[|Rikg)/i.test(line)) {

    return null;

  }

  if (/^[\d.,\s|]+$/.test(line)) return null;



  const m = line.match(MULTIEMBALAJES_CODI_RE);

  if (!m) return null;



  const trailing = parseMultiembalajesTrailing(line.slice(m[0].length).trim());

  if (!trailing.descripcio && !trailing.quantitat) return null;



  return {

    codi: m[1],

    ...trailing

  };

}



/** Parser Multiembalajes (format escanejat, OCR tolerant). */

export function parseMultiembalajesAlbaran(text) {

  const lines = linesOf(text);

  const normalized = normalizeText(text);

  const result = {

    parserId: 'multiembalajes',

    confiança: 'alta',

    proveidorNom: 'Multiembalajes',

    proveidorCif: 'B62835723',

    lotProveidor: '',

    dataDocument: '',

    linies: [],

    notes: []

  };



  const cifFooter = normalized.match(/F\.?\s*B[-\s]?(\d{8})/i);

  const cifHeader = normalized.match(/CIF[:\s-]*(?:ES)?B?(\d{8})/i);

  const cifRaw = cifFooter?.[1] || cifHeader?.[1];

  if (cifRaw) result.proveidorCif = normalizeProveidorCif(`B${cifRaw}`) || result.proveidorCif;



  const headerRow = lines.find((l) =>

    /\d{3}[.\-]\d{3}/.test(l) && /\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}/.test(l)

  );

  if (headerRow) {

    const hm = headerRow.match(/(\d{3}[.\-]\d{3})\s+(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/);

    if (hm) {

      result.lotProveidor = hm[1].replace(/\./g, '');

      result.dataDocument = hm[2];

    }

  }



  if (!result.lotProveidor) {

    const alba = normalized.match(/\b(\d{3}[.\-]\d{3})\b/);

    if (alba) result.lotProveidor = alba[1].replace(/\./g, '');

  }



  if (!result.dataDocument) {

    const dm = normalized.match(/\b(\d{2}[-\/]\d{2}[-\/]\d{4})\b/);

    if (dm) result.dataDocument = dm[1];

  }



  let lastLine = null;

  const startIdx = lines.findIndex((l) => /CANT\s+UNIDADES/i.test(l));

  const endIdx = lines.findIndex((l) => /TOTAL\s+PAQUETES/i.test(l));

  const productLines = startIdx >= 0

    ? lines.slice(startIdx + 1, endIdx >= 0 ? endIdx : undefined)

    : lines.filter((l) => MULTIEMBALAJES_CODI_RE.test(l));



  for (const line of productLines) {

    const parsed = parseMultiembalajesLinia(line);

    if (parsed) {

      result.linies.push(parsed);

      lastLine = parsed;

      continue;

    }



    if (lastLine && line.length > 2 && line.length < 60 && !MULTIEMBALAJES_CODI_RE.test(line)) {

      lastLine.descripcio = `${lastLine.descripcio} ${line}`.trim();

    }

  }



  if (!result.linies.length) result.confiança = 'mitjana';



  return result;

}



export function parseAlbaranText(text) {

  const raw = normalizeText(text);

  if (!raw) {

    return {

      parserId: 'empty',

      confiança: 'baixa',

      proveidorNom: '',

      proveidorCif: '',

      lotProveidor: '',

      dataDocument: '',

      linies: [],

      notes: ['Text buit després de l\'OCR.']

    };

  }



  if (isBegudesFormat(raw)) {

    return parseBegudesAlbaran(raw);

  }



  if (isMultiembalajesFormat(raw)) {

    return parseMultiembalajesAlbaran(raw);

  }



  return parseGenericAlbaran(raw);

}



export function formatLiniesObservacions(parsed) {

  if (!parsed?.linies?.length) return '';

  const header = parsed.parserId === 'begudes'

    ? 'Línies albarà (OCR Begudes):'

    : parsed.parserId === 'multiembalajes'

      ? 'Línies albarà (OCR Multiembalajes):'

      : 'Línies detectades (OCR):';

  const body = parsed.linies

    .map((l) => {

      const q = l.quantitat ? ` ${l.quantitat}${l.unitat ? ` ${l.unitat}` : ''}` : '';

      const extra = [
        l.precioUnitario ? `unit ${l.precioUnitario}` : '',
        l.dto ? `dto ${l.dto}` : '',
        l.iva ? `IVA ${l.iva}%` : '',
        l.importe ? `imp ${l.importe}` : ''
      ].filter(Boolean).join(' · ');

      return `- ${l.codi ? `${l.codi} ` : ''}${l.descripcio || '—'}${q}${extra ? ` · ${extra}` : ''}`;

    })

    .join('\n');

  return `${header}\n${body}`;

}



/**

 * Resol proveïdor Supabase per nom/CIF (llista { id, nom, cif? }).

 * Sense coincidències difuses per paraules comunes (p. ex. "Vallès").

 */

export function matchProveidorId(proveidors, parsed) {

  const list = proveidors || [];

  const cif = String(parsed?.proveidorCif || '').trim().toUpperCase();

  const nom = String(parsed?.proveidorNom || '').trim();



  if (cif) {

    const byCif = list.find((p) => String(p.cif || '').toUpperCase() === cif);

    if (byCif) return byCif.id;

  }



  if (nom) {

    const nomNorm = stripAccents(nom);

    const exact = list.find((p) => stripAccents(p.nom) === nomNorm);

    if (exact) return exact.id;



    const stopWords = new Set(['del', 'de', 'la', 'les', 'els', 'i', 'sa', 'sl', 'sccl', 'emp']);

    const keywords = nomNorm

      .split(/\s+/)

      .filter((w) => w.length > 3 && !stopWords.has(w));



    if (keywords.length >= 2) {

      const byKeywords = list.find((p) => {

        const pn = stripAccents(p.nom);

        const hits = keywords.filter((w) => pn.includes(w));

        return hits.length >= 2;

      });

      if (byKeywords) return byKeywords.id;

    }

  }



  return '';

}



/**

 * Borrador per al formulari de recepció.

 */

export function buildRecepcioDraftFromParsed(parsed, proveidors = []) {

  const liniesText = formatLiniesObservacions(parsed);

  const meta = [];

  if (parsed.dataDocument) meta.push(`Data document: ${parsed.dataDocument}`);

  if (parsed.numFactura) meta.push(`Nº factura: ${parsed.numFactura}`);

  if (parsed.proveidorCif) meta.push(`CIF: ${parsed.proveidorCif}`);

  if (parsed.parserId) meta.push(`Parser: ${parsed.parserId} (confiança ${parsed.confiança})`);

  if (parsed.proveidorNom && !matchProveidorId(proveidors, parsed)) {

    meta.push(`Proveïdor detectat: ${parsed.proveidorNom}`);

  }



  const observacions = [meta.join(' · '), liniesText].filter(Boolean).join('\n\n');



  return {

    id_proveidor: matchProveidorId(proveidors, parsed),

    lot_proveidor: parsed.lotProveidor || '',

    caducitat: '',

    observacions,

    _parsed: parsed

  };

}


