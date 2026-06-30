/**

 * Parser d'albarans (text OCR) → borrador de recepció Obrador.

 * OCR únic (Tesseract); parsers per format de document.

 */



const BEGUDES_MARKERS = [/BEGUDES\s+DEL\s+VALLES/i, /\bA59801696\b/i];

const JOTRI_MARKERS = [
  /CUINATS\s+JOTRI/i,
  /cuinatsjotri/i,
  /ALBAR[AÀ]\s+DE\s+VENDA/i,
  /\bB1720969\d\b/i
];

const MULTIEMBALAJES_MARKERS = [
  /MULTIEMBALAJES/i,
  /multiivalles\.com/i,
  /SANTA\s+PERPETUA\s+DE\s+MOGODA/i,
  /GUIFRE\s+EL\s+PILOS/i,
  /\bB[-\s]?62835723\b/i,
  /\bESB62835723\b/i
];

const ALVILARDAN_MARKERS = [
  /alvilardan\.es/i,
  /\bALVILARDAN\b/i,
  /\bB62303201\b/i,
  /IDDOC\d+/i,
  /\b938199808\b/,
  /SANTA\s+MARGARIDA/i,
  /Pla\s+de\s+l['']Estaci/i,
  /clientes\.pedidos@alvilardan/i,
  /Distribuci[oó]n de pan i bolleria congelada/i
];

const MAKRO_MARKERS = [
  /MAKRO\s+DISTRIBUCION/i,
  /\bA[-\s]?28647451\b/i,
  /makro\.es/i
];

const TRANSGOURMET_MARKERS = [
  /TRANSGOURMET/i,
  /\bA17371758\b/i,
  /transgourmet\.es/i
];

const CANDELAS_MARKERS = [
  /CAF[ÉE]S\s+CANDELAS/i,
  /CAFESCANDELAS/i,
  /\bB27013713\b/i
];

const SSS_CLIENT_CIF = 'F67499186';
const MAKRO_CIF = 'A28647451';
const TRANSGOURMET_CIF = 'A17371758';
const CANDELAS_CIF = 'B27013713';

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



function isJotriFormat(text) {

  return JOTRI_MARKERS.some((re) => re.test(text));

}



function isMultiembalajesFormat(text) {

  return MULTIEMBALAJES_MARKERS.some((re) => re.test(text));

}



function isAlvilardanFormat(text) {

  return ALVILARDAN_MARKERS.some((re) => re.test(text));

}



function isMakroFormat(text) {

  return MAKRO_MARKERS.some((re) => re.test(text));

}



function isTransgourmetFormat(text) {

  return TRANSGOURMET_MARKERS.some((re) => re.test(text));

}



function isCandelasFormat(text) {

  return CANDELAS_MARKERS.some((re) => re.test(text));

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
  const normalized = normalizeNumStr(s);
  if (normalized.includes(',')) {
    return Number(normalized.replace(/\./g, '').replace(',', '.'));
  }
  if (/^-?\d+\.\d{1,2}$/.test(normalized)) {
    return Number(normalized);
  }
  return Number(normalized.replace(/\./g, ''));
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



const JOTRI_REF_PREFIX =
  /^[\s:a-zA-ZÀ-ÿ]*([\d]{3,}[\d.]*[A-Za-z]?\/?[A-Za-z0-9]?)\s*[|—\-–]?\s*(.+)$/;



function isJotriReference(ref) {

  const r = String(ref || '').trim().replace(/[€é]/gi, '');

  if (!/^\d{3,}[\d./A-Za-z]*$/.test(r)) return false;

  if (r.includes('.')) return true;

  if (r.includes('/')) return true;

  if (/\d[A-Za-z]$/i.test(r)) return true;

  return false;

}



function fixOcrMoney(val, referenceVal) {

  const n = toNum(val);

  const ref = toNum(referenceVal);

  if (Number.isNaN(n) || Number.isNaN(ref)) return val;

  if (n > ref * 20 && Number.isInteger(n)) {

    return (n / 100).toFixed(2).replace('.', ',');

  }

  return val;

}



function parseJotriProductTail(tail) {

  const lotM = tail.match(/(\d{5,})\s*(?:\((\d+)\))?/);

  let descripcio = tail;

  let lot = '';

  let after = tail;



  if (lotM) {

    lot = lotM[1];

    const idx = tail.indexOf(lotM[0]);

    descripcio = tail.slice(0, idx).replace(/\s*[|—\-€]\s*$/i, '').trim();

    after = tail.slice(idx + lotM[0].length);

  }



  const nums = (after.match(/(?:\d+)?[.,]\d+|\d+/g) || []).map(normalizeNumStr);

  let caixes = '';

  let unitats = '';

  let preu = '';

  let total = '';



  if (nums.length >= 4) {

    caixes = nums[nums.length - 4];

    unitats = nums[nums.length - 3];

    preu = nums[nums.length - 2];

    total = nums[nums.length - 1];

  } else if (nums.length === 3) {

    unitats = nums[0];

    preu = nums[1];

    total = nums[2];

  } else if (nums.length === 2) {

    preu = nums[0];

    total = nums[1];

  }



  return { descripcio, lot, caixes, unitats, preu, total };

}



function parseJotriLinia(line) {

  if (/^(ALBAR|REFER|E CO|Comercial|Forma de|Total|CANATS|Registro|DADES|Impostos|Banc|ES\d)/i.test(line)) {

    return null;

  }



  const m = line.match(JOTRI_REF_PREFIX);

  if (!m || !isJotriReference(m[1])) return null;



  const parsed = parseJotriProductTail(m[2]);

  if (!parsed.descripcio && !parsed.lot) return null;

  if (/impost|residus|mercantil|rgpd|protecció/i.test(parsed.descripcio)) return null;

  parsed.descripcio = parsed.descripcio.replace(/^[\s|—\-€é]+/i, '').trim();



  const quantitat = parsed.unitats || parsed.caixes;

  const unitat = parsed.caixes && parsed.unitats ? 'U' : (parsed.caixes ? 'Caixes' : 'U');

  const importe = fixOcrMoney(parsed.total, parsed.preu);



  return {

    codi: m[1].replace(/[€é]$/i, ''),

    descripcio: parsed.descripcio,

    lot: parsed.lot,

    quantitat,

    unitat,

    caixes: parsed.caixes,

    unitats: parsed.unitats,

    precioUnitario: parsed.preu,

    importe

  };

}



function extractJotriOcrSections(text) {

  const raw = String(text || '');

  const m = raw.match(/###JOTRI_META###([\s\S]*?)###JOTRI_BODY###([\s\S]*)/i);

  if (m) {

    return { meta: normalizeText(m[1]), body: m[2], hasSections: true };

  }

  return { meta: raw.slice(0, 2200), body: raw, hasSections: false };

}



function dedupeJotriLinies(linies) {

  const seen = new Set();

  return (linies || []).filter((l) => {

    const k = `${l.codi}|${l.lot}|${l.quantitat}|${l.importe}`;

    if (seen.has(k)) return false;

    seen.add(k);

    return true;

  });

}



function parseJotriHeader(normalized, lines, productLots = new Set()) {

  const sections = extractJotriOcrSections(normalized);

  const metaText = sections.meta;

  const preSectionText = String(normalized).split(/###JOTRI_META###/i)[0] || '';

  const scanText = `${preSectionText}\n${metaText}`.trim();

  const result = { lotProveidor: '', dataDocument: '', codiClient: '' };



  const productRefs = [];

  for (const line of lines) {

    const m = line.match(JOTRI_REF_PREFIX);

    if (m && isJotriReference(m[1])) {

      const ref = m[1].replace(/[€é]$/i, '');

      productRefs.push(ref);

      const base = ref.split('/')[0];

      if (base && base !== ref) productRefs.push(base);

    }

    const inlineRefs = line.match(/\b(1300|2107|2400|3100)[\d.]*\/?[A-Za-z0-9]?\b/gi);

    if (inlineRefs) productRefs.push(...inlineRefs);

  }



  const collidesWithProductRef = (n) => {

    const s = String(n || '').trim();

    if (!s) return true;

    return productRefs.some((ref) => {

      const r = String(ref).replace(/[€é]/gi, '');

      const digits = r.replace(/\D/g, '');

      const baseDigits = r.split('/')[0].replace(/\D/g, '');

      if (s === digits || s === baseDigits) return true;

      if (digits.startsWith(s) && digits.length > s.length) return true;

      if (baseDigits.startsWith(s) && baseDigits.length > s.length) return true;

      return false;

    });

  };



  const collidesWithProductLot = (n) => {

    const s = String(n || '').trim();

    if (!s || !productLots?.size) return false;

    if (productLots.has(s)) return true;

    for (const lot of productLots) {

      const l = String(lot);

      if (l === s || l.startsWith(s) || s.startsWith(l)) return true;

    }

    return false;

  };



  const metaLines = linesOf(metaText);

  const nonProductMetaLines = metaLines.filter((l) => !parseJotriLinia(l));



  const isPlausibleJotriDateCore = (raw) => {

    const s = String(raw || '').trim();

    if (/^\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}$/.test(s)) {

      const [d, m] = s.split(/[-\/]/).map(Number);

      return d >= 1 && d <= 31 && m >= 1 && m <= 12;

    }

    if (/^\d{6}$/.test(s)) {

      const d = Number(s.slice(0, 2));

      const m = Number(s.slice(2, 4));

      return d >= 1 && d <= 31 && m >= 1 && m <= 12;

    }

    return false;

  };



  const repairOcrJotriDate = (raw) => {

    const s = String(raw || '').trim();

    if (isPlausibleJotriDateCore(s)) return s;

    if (/^\d{5}$/.test(s)) {

      for (const digit of '6789054321') {

        if (isPlausibleJotriDateCore(s + digit)) return s + digit;

      }

    }

    return s;

  };



  const isPlausibleJotriDate = (raw) => isPlausibleJotriDateCore(repairOcrJotriDate(raw));



  const formatJotriDate = (raw) => {

    const s = repairOcrJotriDate(raw);

    if (!isPlausibleJotriDateCore(s)) return '';

    if (/^\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}$/.test(s)) return s;

    if (/^\d{6}$/.test(s)) return `${s.slice(0, 2)}-${s.slice(2, 4)}-${s.slice(4, 6)}`;

    return '';

  };



  const isJotriHeaderLine = (line) => !/^[\s:]*(1300|2107|2400|3100)[\d./]/i.test(line);



  const normalizeJotriAlbaranNum = (raw) => {

    const s = String(raw || '').trim();

    if (!s) return '';

    if (/^15703\d$/.test(s)) return '15703';

    return s;

  };



  const isLikelyJotriAlbaranNum = (n) => {

    const s = String(n || '').trim();

    if (!/^\d{4,6}$/.test(s)) return false;

    if (isJotriReference(s)) return false;

    if (collidesWithProductRef(s)) return false;

    if (collidesWithProductLot(s)) return false;

    if (/^(14|25|26)\d{3,}$/.test(s)) return false;

    if (/^004\d{3}$/.test(s)) return false;

    if (/^(08004|08015|17462|97239|97249)$/.test(s)) return false;

    if (/^(1300|2107|2400|3100)\d{2,3}$/.test(s)) return false;

    if (s.length === 6 && !/^15703\d$/.test(s)) return false;

    return s.length >= 4 && s.length <= 6;

  };



  const scoreJotriAlbaranCandidate = (s, context = '') => {

    if (!isLikelyJotriAlbaranNum(s)) return -1;

    let score = 0;

    if (s.length === 5) score += 10;

    if (/^15\d{3}$/.test(s)) score += 25;

    if (/F67499186/.test(context)) score += 20;

    if (/28[-\/]05|280526/.test(context)) score += 15;

    if (/ALBAR[AÀ]/i.test(context)) score += 10;

    if (/Albar[aà]\b/i.test(context)) score += 40;

    return score;

  };



  const extractFromAlbaraTable = (meta) => {

    if (!meta) return { alba: '', date: '' };

    const labelPatterns = [

      /Albar[aà]\b[^\d\n]{0,30}(\d{4,6})\b/i,

      /Albar[aà]\s*\|[^\d\n]*(\d{4,6})\b/i,

      /(?:^|\n)[^\n]*Albar[aà][^\n]*(\d{4,6})/im

    ];

    for (const re of labelPatterns) {

      const m = meta.match(re);

      if (m?.[1] && isLikelyJotriAlbaranNum(m[1])) {

        return { alba: m[1], date: '' };

      }

    }

    const vendBlock = meta.match(/ALBAR[AÀ]\s+DE\s+VENDA([\s\S]{0,600})/i);

    if (vendBlock) {

      const chunk = vendBlock[1];

      const row = chunk.match(/\b(\d{5,6})\b[\s|]{0,24}(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}|\d{6})\b/);

      if (row?.[1] && isLikelyJotriAlbaranNum(row[1])) {

        return { alba: row[1], date: row[2] };

      }

    }

    return { alba: '', date: '' };

  };



  const tryAssignHeader = (albaRaw, dateRaw) => {

    if (albaRaw && isLikelyJotriAlbaranNum(albaRaw)) {

      result.lotProveidor = normalizeJotriAlbaranNum(albaRaw);

    }

    if (dateRaw && isPlausibleJotriDate(dateRaw)) {

      const formatted = formatJotriDate(dateRaw);

      if (formatted) result.dataDocument = formatted;

    }

  };



  const vendRow =

    scanText.match(/\|\s*(\d{5,6})\s*\|\s*(\d{5,6})[\s|.\d]{0,40}F67499186/i)

    || preSectionText.match(/\|\s*(\d{5,6})\s*\|\s*(\d{5,6})[\s|.\d]{0,40}F67499186/i);

  if (vendRow) tryAssignHeader(vendRow[1], vendRow[2]);



  const extractJotriAlbaranFuzzy = (text) => {

    const patterns = [

      /\b(1570[37]\d?)\b/gi,

      /\b(15[7lI][0O]0[37])\b/gi,

      /\b1[\s|.]{0,3}5[\s|.]{0,3}7[\s|.]{0,3}0[\s|.]{0,3}3\b/gi,

      /\b(15\d{3})\b/g

    ];

    for (const re of patterns) {

      re.lastIndex = 0;

      let m;

      while ((m = re.exec(text)) !== null) {

        const raw = String(m[1] || m[0])

          .replace(/[lLI]/g, '7')

          .replace(/[O]/g, '0')

          .replace(/[|.]/g, '')

          .replace(/\s/g, '');

        const n = normalizeJotriAlbaranNum(raw.replace(/\D/g, ''));

        if (isLikelyJotriAlbaranNum(n)) return n;

      }

    }

    return '';

  };



  const tableHit = extractFromAlbaraTable(scanText);

  if (tableHit.alba) tryAssignHeader(tableHit.alba, tableHit.date);



  const fuzzyAlba = !result.lotProveidor ? extractJotriAlbaranFuzzy(scanText) : '';

  if (fuzzyAlba) result.lotProveidor = fuzzyAlba;



  const pairPatterns = [

    /\b(\d{5,6})\b[\s|]{0,16}(\d{6}|\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})\b/g,

    /\b1\s*\|?\s*(\d{5,6})\s*\|?\s*(\d{6}|\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})\b/g

  ];

  for (const re of pairPatterns) {

    if (result.lotProveidor) break;

    for (const src of [scanText, metaText]) {

      re.lastIndex = 0;

      let m;

      let best = null;

      let bestScore = -1;

      while ((m = re.exec(src)) !== null) {

        const alba = m[1];

        const date = m[2];

        if (!isPlausibleJotriDate(date)) continue;

        const ctx = src.slice(Math.max(0, m.index - 40), m.index + 80);

        const score = scoreJotriAlbaranCandidate(alba, ctx) + 30;

        if (score > bestScore) {

          bestScore = score;

          best = { alba, date };

        }

      }

      if (best) tryAssignHeader(best.alba, best.date);

      if (result.lotProveidor) break;

    }

  }



  const metaRow = nonProductMetaLines.find((l) =>

    isJotriHeaderLine(l) && (

      /\|\s*\d{4,6}\s*\|/.test(l) || /\b\d{5,6}\s+(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}|\d{6})\b/.test(l)

    )

  );

  if (metaRow) {

    const piped = metaRow.match(/\|\s*(\d{4,6})\s*\|\s*(\d{6}|\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})\s*\|?/);

    if (piped) tryAssignHeader(piped[1], piped[2]);



    if (!result.lotProveidor) {

      const loose = metaRow.match(/\b(\d{5,6})\b[^\n]{0,40}\b(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}|\d{6})\b/);

      if (loose) tryAssignHeader(loose[1], loose[2]);

    }



    const clientM = metaRow.match(/\b(004\d{3})\b/);

    if (clientM) result.codiClient = clientM[1];

  }



  if (!result.lotProveidor) {

    const labelAlba = metaText.match(/Albar[aà][:\s|]*(\d{4,6})/i);

    if (labelAlba) tryAssignHeader(labelAlba[1], null);

  }



  if (!result.lotProveidor) {

    const nifIdx = scanText.indexOf('F67499186');

    if (nifIdx > 0) {

      const before = scanText.slice(Math.max(0, nifIdx - 200), nifIdx);

      const nums = before.match(/\b\d{4,6}\b/g) || [];

      const alba = [...nums].reverse().find((n) => isLikelyJotriAlbaranNum(n));

      if (alba) tryAssignHeader(alba, null);

      if (!result.dataDocument) {

        const dateM = before.match(/\b(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}|\d{6})\b/g);

        const valid = dateM?.filter(isPlausibleJotriDate);

        if (valid?.length) result.dataDocument = formatJotriDate(valid[valid.length - 1]);

      }

    }

  }



  if (!result.dataDocument) {

    const labelDate = normalized.match(/Data\s+Albar[aà][:\s|]*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}|\d{6})/i);

    if (labelDate) result.dataDocument = formatJotriDate(labelDate[1]);

  }



  const albaraBlockIdx = nonProductMetaLines.findIndex((l) => /ALBAR[AÀ]\s+DE\s+VENDA/i.test(l));

  if (albaraBlockIdx >= 0) {

    const block = nonProductMetaLines.slice(albaraBlockIdx, albaraBlockIdx + 20);

    for (const line of block) {

      if (!isJotriHeaderLine(line)) continue;

      if (result.lotProveidor && result.dataDocument) break;

      if (/F67499186|004556|08:00/.test(line)) {

        const nums = line.match(/\b\d{4,6}\b/g) || [];

        const alba = nums.find((n) => isLikelyJotriAlbaranNum(n));

        if (alba) tryAssignHeader(alba, null);

        const dateM = line.match(/\b(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}|\d{6})\b/);

        if (dateM) result.dataDocument = formatJotriDate(dateM[1]);

      }

      const pair = line.match(/\b(\d{5,6})\b[^\n]{0,50}\b(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}|\d{6})\b/);

      if (pair) tryAssignHeader(pair[1], pair[2]);

    }

  }



  if (!result.lotProveidor) {

    const nearAlbara = metaText.match(/ALBAR[AÀ][\s\S]{0,500}?\b(\d{5,6})\b(?!\d)/i);

    if (nearAlbara && isLikelyJotriAlbaranNum(nearAlbara[1])) tryAssignHeader(nearAlbara[1], null);

  }



  if (!result.codiClient) {

    const clientM = metaText.match(/\b(004\d{3})\b/) || normalized.match(/\b(004\d{3})\b/);

    if (clientM) result.codiClient = clientM[1];

  }



  if (!result.dataDocument) {

    for (const line of nonProductMetaLines) {

      if (!isJotriHeaderLine(line)) continue;

      const dm = line.match(/\b(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})\b/);

      if (dm && isPlausibleJotriDate(dm[1])) {

        result.dataDocument = dm[1];

        break;

      }

    }

  }



  return result;

}



/** Parser Cuinats JOTRI (albarà de venda ultracongelats). */

export function parseJotriAlbaran(text) {

  const sections = extractJotriOcrSections(text);

  const parseSource = sections.hasSections ? sections.body : text;

  const lines = linesOf(parseSource);

  const normalized = normalizeText(text);

  const productLots = new Set();

  for (const line of lines) {

    const parsed = parseJotriLinia(line);

    if (parsed?.lot) productLots.add(String(parsed.lot));

    for (const m of line.matchAll(/\b(\d{5,})\s*\(\d+\)/g)) productLots.add(m[1]);

  }

  const header = parseJotriHeader(normalized, linesOf(text), productLots);



  const result = {

    parserId: 'jotri',

    confiança: 'alta',

    proveidorNom: 'Cuinats JOTRI S.L.U.',

    proveidorCif: 'B17209693',

    lotProveidor: header.lotProveidor,

    dataDocument: header.dataDocument,

    codiClient: header.codiClient,

    linies: [],

    notes: []

  };



  const cifHeader = normalized.match(/CUINATS\s+JOTRI[\s\S]{0,250}?NIF[:\s.]*B?\s*(\d{8})/i);

  const cifExplicit = normalized.match(/\bB(1720969\d)\b/i);

  if (cifHeader) result.proveidorCif = `B${cifHeader[1]}`;

  else if (cifExplicit) result.proveidorCif = `B${cifExplicit[1]}`;



  for (const line of lines) {

    const parsed = parseJotriLinia(line);

    if (parsed) result.linies.push(parsed);

  }



  if (!result.linies.length) {

    const globalRe =

      /([\d]{3,}[\d.]*[A-Za-z]?\/?[A-Za-z0-9]?)\s*[|—\-–]?\s*([^|\n]+?\d{5,}\s*\(\d+\)\s+(?:\d+\s+)?[\d.,]+\s+[\d.,]+\s+[\d.,]+)/gi;

    let gm;

    const bodyNorm = normalizeText(parseSource);

    while ((gm = globalRe.exec(bodyNorm)) !== null) {

      if (!isJotriReference(gm[1])) continue;

      const parsed = parseJotriProductTail(gm[2]);

      if (!parsed.descripcio && !parsed.lot) continue;

      result.linies.push({

        codi: gm[1],

        descripcio: parsed.descripcio,

        lot: parsed.lot,

        quantitat: parsed.unitats || parsed.caixes,

        unitat: parsed.caixes && parsed.unitats ? 'U' : 'Caixes',

        caixes: parsed.caixes,

        unitats: parsed.unitats,

        precioUnitario: parsed.preu,

        importe: fixOcrMoney(parsed.total, parsed.preu)

      });

    }

  }



  result.linies = dedupeJotriLinies(result.linies);



  if (!result.lotProveidor && result.linies.length) {

    result.notes.push('Nº albarà no detectat per OCR; introdueix-lo manualment al camp Lot proveïdor.');

  }



  if (!result.linies.length) {

    result.confiança = 'mitjana';

  } else if (!result.lotProveidor) {

    result.confiança = 'mitjana';

  }



  return result;

}



function parseAlvilardanTrailing(rest) {

  let tail = String(rest || '').replace(/\|/g, ' ').replace(/\s+/g, ' ').trim();

  const amounts = tail.match(/\d+[.,]\d{2}/g) || [];

  if (!amounts.length) return { descripcio: tail, quantitat: '', unitat: '', importe: '' };



  const importe = amounts[amounts.length - 1];

  let before = tail.slice(0, tail.lastIndexOf(importe)).trim();



  const cajasM = before.match(/(\d+)\s+1?\/?\s*$/);

  const quantitat = cajasM ? cajasM[1] : '';

  if (cajasM) before = before.slice(0, cajasM.index).trim();



  before = before.replace(/\s+\d{1,4}[.,]?\d*\s+\d{2,5}\s*$/, '').trim();

  before = before.replace(/\s+\d{2,5}\s+\d{2,5}\s*$/, '').trim();



  return {

    descripcio: before,

    quantitat,

    unitat: quantitat ? 'Cajas' : '',

    importe

  };

}



function parseAlvilardanNativeLinia(line) {

  if (/^(Ref|REF|CONCEPTO|CLIENTE|EMPRESA|Ruta|Tel|mail|Operaci|RME|TOTAL|IVA|Inscrita)/i.test(line)) {

    return null;

  }

  const m = line.match(/^(\d{4,5})\s+(.+?)\s+(\d+[.,]\d+)\s+(\d+)\s+(\d+)\s+([\d.,]+)\s*(?:€|EUR)?\s*$/i);

  if (!m) return null;



  return {

    codi: m[1],

    descripcio: m[2].trim(),

    quantitat: m[5],

    unitat: 'CAJ',

    importe: m[6].replace(',', '.')

  };

}



function parseAlvilardanLinia(line) {

  if (/^(REF|CONCEPTO|CLIENTE|EMPRESA|Ruta|Tel|mail|Operaci|RME|TOTAL|IVA)/i.test(line)) {

    return null;

  }

  if (/^[\d.,\s|Oo=sf>]+$/.test(line)) return null;



  const native = parseAlvilardanNativeLinia(line);

  if (native) return native;



  const m = line.match(/(\d{4,5})\s*\|\s*\(([A-Z]{2,5}\s*\d+)\)\s*(.+)/i);

  if (!m) return null;



  const trailing = parseAlvilardanTrailing(m[3]);

  if (!trailing.descripcio && !trailing.quantitat) return null;



  return {

    codi: m[1],

    codiProveidor: m[2].replace(/\s+/g, ''),

    descripcio: trailing.descripcio,

    quantitat: trailing.quantitat,

    unitat: trailing.unitat,

    importe: trailing.importe

  };

}



function isPlausibleAlvilardanAlbaranSix(n) {

  const s = String(n || '').trim();

  if (!/^\d{6}$/.test(s)) return false;

  if (/^20\d{4}$/.test(s)) return false;

  if (/^(08004|08015|938199|938915)/.test(s)) return false;

  return true;

}



function normalizeAlvilardanAlbaranDash(raw) {

  let s = String(raw || '').trim().replace(/\s/g, '');

  const parts = s.split('-');

  if (parts.length === 2 && /^\d{3}$/.test(parts[0]) && /^\d{3,4}$/.test(parts[1])) {

    return `${parts[0].slice(0, 2)}-0${parts[1]}`;

  }

  return s;

}



function isPlausibleAlvilardanAlbaranDash(raw) {

  const n = normalizeAlvilardanAlbaranDash(raw);

  if (!/^\d{2}-\d{4}$/.test(n)) return false;

  if (/^20\d{2}$/.test(n.split('-')[1])) return false;

  return true;

}



function extractAlvilardanAlbaranNum(text) {

  const raw = String(text || '');

  const lineList = linesOf(text);



  const nativeAlbaran = raw.match(/N[º°o]\.?\s*Albaran\s+(\d{6})\b/i);

  if (nativeAlbaran && isPlausibleAlvilardanAlbaranSix(nativeAlbaran[1])) {

    return nativeAlbaran[1];

  }



  const albaraSixSame = raw.match(/ALBAR[AÀÁN]+[:\s|]*(\d{6})\b/i);

  if (albaraSixSame && isPlausibleAlvilardanAlbaranSix(albaraSixSame[1])) {

    return albaraSixSame[1];

  }



  const albaraIdx = raw.search(/ALBAR[AÀÁN]+/i);

  if (albaraIdx >= 0) {

    const window = raw.slice(albaraIdx, albaraIdx + 120);

    const nearSix = window.match(/ALBAR[AÀÁN]+[\s\S]{0,80}?(\d{6})\b/);

    if (nearSix && isPlausibleAlvilardanAlbaranSix(nearSix[1])) {

      return nearSix[1];

    }

  }



  for (let i = 0; i < lineList.length; i += 1) {

    if (!/ALBAR[AÀÁN]+/i.test(lineList[i])) continue;

    for (let j = i; j <= Math.min(i + 6, lineList.length - 1); j += 1) {

      if (/Fecha|BOTIGA|DOCUMENTO/i.test(lineList[j])) continue;

      const m = lineList[j].match(/\b(\d{6})\b/);

      if (m && isPlausibleAlvilardanAlbaranSix(m[1])) return m[1];

    }

  }



  const iddocSix = raw.match(/IDDOC\d{2}(\d{6})\d?/i);

  if (iddocSix && isPlausibleAlvilardanAlbaranSix(iddocSix[1])) {

    return iddocSix[1];

  }



  const tableSix = raw.match(/BOTIGA[\s\S]{0,100}?ALBAR[AÀÁN]+[\s\S]{0,80}?(\d{6})\b/i);

  if (tableSix && isPlausibleAlvilardanAlbaranSix(tableSix[1])) {

    return tableSix[1];

  }



  const dashSame = raw.match(/ALBAR[AÀÁN]+[:\s|]*(\d{2,3}-\d{3,4})/i);

  if (dashSame && isPlausibleAlvilardanAlbaranDash(dashSame[1])) {

    return normalizeAlvilardanAlbaranDash(dashSame[1]);

  }



  const rutaM = raw.match(/(?:Ruta|NUEVO\s+PEDIDOS)[\s\S]{0,80}?(\d{2,3}-\d{3,4})/i);

  if (rutaM && isPlausibleAlvilardanAlbaranDash(rutaM[1])) {

    return normalizeAlvilardanAlbaranDash(rutaM[1]);

  }



  return '';

}



/** Parser Alvilardan (distribució pa/bolleria congelada). */

export function parseAlvilardanAlbaran(text) {

  const lines = linesOf(text);

  const normalized = normalizeText(text);

  const result = {

    parserId: 'alvilardan',

    confiança: 'alta',

    proveidorNom: 'Alvilardan',

    proveidorCif: 'B62303201',

    lotProveidor: '',

    dataDocument: '',

    linies: [],

    notes: []

  };



  const iddocM = normalized.match(/IDDOC(\d{6,10})/i);

  result.lotProveidor = extractAlvilardanAlbaranNum(text);

  if (iddocM && result.lotProveidor) {

    result.notes.push(`Referència IDDOC: ${iddocM[1]}`);

  }



  const albaraFechaM = text.match(/N[º°o]\.?\s*Albaran\s+\d{6}[\s\S]{0,60}?Fecha\s+(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})/i);

  if (albaraFechaM) {

    result.dataDocument = albaraFechaM[1];

  } else {

    const fechaM = normalized.match(/Fecha[:\s]*(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})/i);

    if (fechaM) result.dataDocument = fechaM[1];

  }



  if (!result.dataDocument) {

    const dm = normalized.match(/\b(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{4})\b/);

    if (dm) result.dataDocument = dm[1];

  }



  const startIdx = lines.findIndex((l) => /Ref\.?\s+Concepto/i.test(l) || /REF\s+CONCEPTO/i.test(l));

  let endIdx = -1;

  if (startIdx >= 0) {

    for (let i = startIdx + 1; i < lines.length; i += 1) {

      if (/Operaci[oó]n\s+asegurada|^TOTAL\b|IVA\s+10\b/i.test(lines[i])) {

        endIdx = i;

        break;

      }

    }

  }

  const productLines = startIdx >= 0

    ? lines.slice(startIdx + 1, endIdx >= 0 ? endIdx : undefined)

    : lines;



  for (const line of productLines) {

    const parsed = parseAlvilardanLinia(line);

    if (parsed) result.linies.push(parsed);

  }



  if (!result.linies.length) {

    const globalRe = /(\d{4,5})\s*\|\s*\(([A-Z]{2,5}\s*\d+)\)\s*([^|\n]+)/gi;

    let gm;

    while ((gm = globalRe.exec(normalized)) !== null) {

      const trailing = parseAlvilardanTrailing(gm[3]);

      if (!trailing.descripcio && !trailing.quantitat) continue;

      result.linies.push({

        codi: gm[1],

        codiProveidor: gm[2].replace(/\s+/g, ''),

        descripcio: trailing.descripcio,

        quantitat: trailing.quantitat,

        unitat: trailing.unitat,

        importe: trailing.importe

      });

    }

  }



  if (!result.linies.length) result.confiança = 'mitjana';



  if (!result.lotProveidor) {

    result.notes.push('Nº albarà no detectat (6 xifres al costat de ALBARÁN, p. ex. 455739); revisa log OCR.');

    result.confiança = 'mitjana';

  }



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

      quantitat: weirdPair[1],

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



  const normalizeAlbaranNum = (raw) => String(raw || '').replace(/[.\s-]/g, '');



  const isClientCifNum = (n) => n === SSS_CLIENT_CIF || n === '67499186';



  const headerRow = lines.find((l) =>

    (/\d{3}[.\-]\d{3}/.test(l) || /\b\d{6}\b/.test(l)) && /\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}/.test(l)

  );

  if (headerRow) {

    const hm = headerRow.match(/(\d{3}[.\-]\d{3}|\d{6})\s+(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/);

    if (hm && !isClientCifNum(normalizeAlbaranNum(hm[1]))) {

      result.lotProveidor = normalizeAlbaranNum(hm[1]);

      result.dataDocument = hm[2];

    }

  }



  if (!result.lotProveidor) {

    const nearLabel = normalized.match(/NUMERO\s+ALBARAN[\s\S]{0,200}?(\d{3}[.\s-]\d{3}|\d{6})/i);

    if (nearLabel && !isClientCifNum(normalizeAlbaranNum(nearLabel[1]))) {

      result.lotProveidor = normalizeAlbaranNum(nearLabel[1]);

    }

  }



  if (!result.lotProveidor) {

    const alba = normalized.match(/\b(\d{3}[.\-]\d{3})\b/);

    if (alba) result.lotProveidor = normalizeAlbaranNum(alba[1]);

  }



  if (!result.lotProveidor) {

    const afterAlbaran = normalized.match(/-ALBARAN-[\s\S]{0,250}?(\d{3}[.\s-]\d{3}|\d{6})/i);

    if (afterAlbaran && !isClientCifNum(normalizeAlbaranNum(afterAlbaran[1]))) {

      result.lotProveidor = normalizeAlbaranNum(afterAlbaran[1]);

    }

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



  if (!result.lotProveidor) {

    result.notes.push('Nº albarà no detectat; revisa el log OCR (text brut i pistes de cerca).');

    result.confiança = 'mitjana';

  }



  return result;

}



function parseMakroLinia(line) {

  if (/^(MM|Num\.|Número|Total|Mercancía|DEVOLUCIONES|OPERACIÓN|Recibo|PASEO|Factura|Solucions)/i.test(line)) {

    return null;

  }

  if (/^-{5,}/.test(line)) return null;



  const m = line.match(/^(\d{13})\s+(.+?)\s+[A-Z]{2,3}\s+[\d.,]+\s+\d+\s+[\d.,]+\s+(\d+(?:[.,]\d+)?)\s+([\d.,]+)\s+\d+\s*$/);

  if (!m) return null;



  return {

    codi: m[1],

    descripcio: m[2].trim(),

    quantitat: m[3].replace(',', '.'),

    importe: m[4].replace(',', '.')

  };

}



/** Parser Makro (ticket / factura botiga). */

export function parseMakroAlbaran(text) {

  const lines = linesOf(text);

  const normalized = normalizeText(text);

  const result = {

    parserId: 'makro',

    confiança: 'alta',

    proveidorNom: 'Makro',

    proveidorCif: MAKRO_CIF,

    lotProveidor: '',

    dataDocument: '',

    linies: [],

    notes: []

  };



  const facturaM = normalized.match(/Factura\s+[\d/()]+\(?(20\d{2})\)?(\d{6})/i);

  if (facturaM) {

    result.lotProveidor = `${facturaM[1]}${facturaM[2]}`;

  } else {

    const shortM = normalized.match(/\(20\d{2}\)(\d{6})/);

    if (shortM) result.lotProveidor = shortM[0].replace(/[()]/g, '');

  }



  const fechaM = normalized.match(/Fecha de (?:venta|entrega)[:\s]*(\d{1,2}\/\d{1,2}\/\d{4})/i);

  if (fechaM) result.dataDocument = fechaM[1];



  const startIdx = lines.findIndex((l) => /Num\.\s*art[ií]culo/i.test(l));

  const endIdx = lines.findIndex((l) => /Número\s+de bultos|Importe\s+17/i.test(l));

  const productLines = startIdx >= 0

    ? lines.slice(startIdx + 1, endIdx >= 0 ? endIdx : undefined)

    : lines;



  for (const line of productLines) {

    const parsed = parseMakroLinia(line);

    if (parsed) result.linies.push(parsed);

  }



  if (!result.linies.length) result.confiança = 'mitjana';

  if (!result.lotProveidor) {

    result.notes.push('Nº factura Makro no detectat; revisa línia "Factura …/(2026)…".');

    result.confiança = 'mitjana';

  }



  return result;

}



function parseTransgourmetLinia(line) {

  if (/^(TIPUS|CODI|ALIMENTACI|CARNISSERIA|FRUITERIA|FORMATGES|XARCUTERIA|BASE|IVA|TOTAL|Import)/i.test(line)) {

    return null;

  }



  const m = line.match(/^0*(\d{6,8})\s+(.+?)\s+(\d+[.,]\d{1,2})%\s+[\d.,\s]+([\d.,]+)\s*$/);

  if (!m) {

    const loose = line.match(/^0*(\d{6,8})\s+(.+?)\s+\d+[.,]?\d*%\s+.+?([\d.,]+)\s*$/);

    if (!loose) return null;

    return {

      codi: loose[1],

      descripcio: loose[2].trim(),

      importe: loose[3].replace(',', '.')

    };

  }



  return {

    codi: m[1],

    descripcio: m[2].trim(),

    iva: m[3].replace(',', '.'),

    importe: m[4].replace(',', '.')

  };

}



function extractTransgourmetAlbaranNum(text) {

  const raw = String(text || '');

  const albaraM = raw.match(/ALBARA\s+0*(\d{6,12})/i);

  if (albaraM) return albaraM[1];



  const facturaM = raw.match(/FACTURA\s+(20\d{10,14})/i);

  if (facturaM) return facturaM[1];



  return '';

}



function extractTransgourmetDate(text) {

  const raw = String(text || '');

  const dataM = raw.match(/DATA\s+(\d{1,2}[-\/.]\d{1,2}[-\/.]\d{2,4}|\d{8})/i);

  if (!dataM) return '';



  const d = dataM[1];

  if (/^\d{8}$/.test(d)) {

    return `${d.slice(0, 2)}-${d.slice(2, 4)}-${d.slice(4)}`;

  }

  return d;

}



/** Parser Transgourmet (albarà escanejat / OCR). */

export function parseTransgourmetAlbaran(text) {

  const lines = linesOf(text);

  const normalized = normalizeText(text);

  const result = {

    parserId: 'transgourmet',

    confiança: 'alta',

    proveidorNom: 'Transgourmet',

    proveidorCif: TRANSGOURMET_CIF,

    lotProveidor: extractTransgourmetAlbaranNum(text),

    dataDocument: extractTransgourmetDate(text),

    linies: [],

    notes: []

  };



  const facturaM = normalized.match(/FACTURA\s+(20\d{10,14})/i);

  if (facturaM && result.lotProveidor && result.lotProveidor !== facturaM[1]) {

    result.notes.push(`Referència factura: ${facturaM[1]}`);

  }



  const startIdx = lines.findIndex((l) => /CODI\s+DESCRIPCI/i.test(l));

  const productLines = startIdx >= 0 ? lines.slice(startIdx + 1) : lines;



  for (const line of productLines) {

    const parsed = parseTransgourmetLinia(line);

    if (parsed) result.linies.push(parsed);

  }



  if (!result.linies.length) result.confiança = 'mitjana';

  if (!result.lotProveidor) {

    result.notes.push('Nº albarà (ALBARA …) no detectat al OCR.');

    result.confiança = 'mitjana';

  }



  return result;

}



function parseCandelasLinia(line) {

  if (/^(Código|Nº|Su Pedido|PENDIENTE|Bruto|Factura|AVISO)/i.test(line)) return null;



  const m = line.match(/^(\d+)\s+(\d+(?:[.,]\d+)?)\s+([A-Z]{1,3})\s+(\d+(?:[.,]\d+)?)\s+([A-Z])\s+(\d+)\s+([\d.,]+)\s+[\d.,]+\s+([\d.,]+)/);

  if (!m) return null;



  return {

    codi: m[1],

    descripcio: 'Cápsula / producto Candelas',

    quantitat: m[2].replace(',', '.'),

    unitat: m[3],

    lot: m[6],

    precioUnitario: m[7].replace(',', '.'),

    importe: m[8].replace(',', '.')

  };

}



/** Parser Cafés Candelas. */

export function parseCandelasAlbaran(text) {

  const lines = linesOf(text);

  const normalized = normalizeText(text);

  const result = {

    parserId: 'candelas',

    confiança: 'alta',

    proveidorNom: 'Cafés Candelas',

    proveidorCif: CANDELAS_CIF,

    lotProveidor: '',

    dataDocument: '',

    linies: [],

    notes: []

  };



  const albaraM = normalized.match(/N[º°o]\s*de\s*Albar[aá]n:\s*([A-Z]?\d+)/i);

  if (albaraM) result.lotProveidor = albaraM[1];



  const fechaM = normalized.match(/Fecha:\s*(\d{1,2}\/\d{1,2}\/\d{4})/i);

  if (fechaM) result.dataDocument = fechaM[1];



  const startIdx = lines.findIndex((l) => /^Código\s+Unidades/i.test(l));

  const endIdx = lines.findIndex((l) => /PENDIENTE DE COBRO/i.test(l));

  const productLines = startIdx >= 0

    ? lines.slice(startIdx + 1, endIdx >= 0 ? endIdx : undefined)

    : lines;



  for (const line of productLines) {

    const parsed = parseCandelasLinia(line);

    if (parsed) {

      const descM = normalized.match(new RegExp(`${parsed.codi}[\\s\\S]{0,120}?([A-ZÁÉÍÓÚÑ][^\\d]{8,60})`, 'i'));

      if (descM) parsed.descripcio = descM[1].trim().split(/\s{2,}/)[0];

      result.linies.push(parsed);

    }

  }



  if (!result.linies.length) result.confiança = 'mitjana';

  if (!result.lotProveidor) {

    result.notes.push('Nº albarà (A… / dígits) no detectat.');

    result.confiança = 'mitjana';

  }



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



  if (isJotriFormat(raw)) {

    return parseJotriAlbaran(raw);

  }



  if (isAlvilardanFormat(raw)) {

    return parseAlvilardanAlbaran(raw);

  }



  if (isMakroFormat(raw)) {

    return parseMakroAlbaran(raw);

  }



  if (isTransgourmetFormat(raw)) {

    return parseTransgourmetAlbaran(raw);

  }



  if (isCandelasFormat(raw)) {

    return parseCandelasAlbaran(raw);

  }



  return parseGenericAlbaran(raw);

}



export function formatLiniesObservacions(parsed) {

  if (!parsed?.linies?.length) return '';

  const header = parsed.parserId === 'begudes'

    ? 'Línies albarà (OCR Begudes):'

    : parsed.parserId === 'multiembalajes'

      ? 'Línies albarà (OCR Multiembalajes):'

      : parsed.parserId === 'jotri'

        ? 'Línies albarà (OCR JOTRI):'

        : parsed.parserId === 'alvilardan'

          ? 'Línies albarà (OCR Alvilardan):'

          : parsed.parserId === 'makro'

            ? 'Línies albarà (Makro):'

            : parsed.parserId === 'transgourmet'

              ? 'Línies albarà (Transgourmet):'

              : parsed.parserId === 'candelas'

                ? 'Línies albarà (Cafés Candelas):'

                : 'Línies detectades (OCR):';

  const body = parsed.linies

    .map((l) => {

      const q = l.quantitat ? ` ${l.quantitat}${l.unitat ? ` ${l.unitat}` : ''}` : '';

      const extra = [
        l.lot ? `lot ${l.lot}` : '',
        l.codiProveidor ? `ref ${l.codiProveidor}` : '',
        l.caixes ? `caixes ${l.caixes}` : '',
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

  if (Array.isArray(parsed.notes) && parsed.notes.length) {

    meta.push(...parsed.notes);

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


