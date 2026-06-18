/**

 * Parser d'albarans (text OCR) → borrador de recepció Obrador.

 * OCR únic (Tesseract); parsers per format de document.

 */



const BEGUDES_MARKERS = [/BEGUDES\s+DEL\s+VALLES/i, /\bA59801696\b/i];

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

    result.proveidorCif = cifs.find((c) => c.startsWith('A') || c.startsWith('B')) || cifs[0];

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



  return parseGenericAlbaran(raw);

}



export function formatLiniesObservacions(parsed) {

  if (!parsed?.linies?.length) return '';

  const header = parsed.parserId === 'begudes'

    ? 'Línies albarà (OCR Begudes):'

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


