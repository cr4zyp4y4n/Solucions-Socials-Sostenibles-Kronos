/**
 * Informe de depuració OCR + parser (text pla descarregable).
 */

function linesOf(text) {
  return String(text || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

function multiembalajesSearchHints(text) {
  const normalized = String(text || '');
  const lines = linesOf(text);
  const hints = [];

  hints.push(`Marcador "-ALBARAN-": ${/-ALBARAN-/i.test(normalized) ? 'sí' : 'no'}`);
  hints.push(`Capçalera "NUMERO ALBARAN": ${/NUMERO\s+ALBARAN/i.test(normalized) ? 'sí' : 'no'}`);
  hints.push(`Capçalera "CANT UNIDADES": ${/CANT\s+UNIDADES/i.test(normalized) ? 'sí' : 'no'}`);
  hints.push(`Secció JOTRI_META (OCR PDF JOTRI): ${/###JOTRI_META###/i.test(normalized) ? 'sí — pot ser OCR de PDF amb retalls JOTRI' : 'no'}`);

  const albaranFormats = [
    ...normalized.matchAll(/\b\d{3}[.\s-]\d{3}\b/g),
    ...normalized.matchAll(/\b\d{6}\b/g)
  ].map((m) => m[0]);

  if (albaranFormats.length) {
    hints.push(`Números tipus albarà trobats: ${[...new Set(albaranFormats)].join(', ')}`);
  } else {
    hints.push('Números tipus albarà (###.### o ######): cap coincidència');
  }

  const dates = normalized.match(/\b\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}\b/g) || [];
  hints.push(dates.length ? `Dates trobades: ${[...new Set(dates)].join(', ')}` : 'Dates: cap coincidència');

  const headerRows = lines.filter((l) =>
    /\d{3}[.\-]\d{3}/.test(l) && /\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}/.test(l)
  );
  if (headerRows.length) {
    hints.push(`Línies candidata capçalera albarà+data:\n  - ${headerRows.join('\n  - ')}`);
  } else {
    hints.push('Línia amb nº albarà i data a la mateixa fila: no trobada (OCR pot haver partit la fila)');
  }

  const nearAlbara = normalized.match(/NUMERO\s+ALBARAN[\s\S]{0,160}/i);
  if (nearAlbara) {
    hints.push(`Text després de "NUMERO ALBARAN":\n${nearAlbara[0].slice(0, 160)}`);
  }

  return hints;
}

function jotriSearchHints(text, parsed) {
  const normalized = String(text || '');
  const metaMatch = normalized.match(/###JOTRI_META###([\s\S]*?)###JOTRI_BODY###([\s\S]*)/i);
  const metaText = metaMatch ? metaMatch[1] : normalized.slice(0, 2200);
  const bodyText = metaMatch ? metaMatch[2] : normalized;
  const hints = [];

  hints.push(`Marcador "CUINATS JOTRI": ${/CUINATS\s+JOTRI/i.test(normalized) ? 'sí' : 'no'}`);
  hints.push(`Capçalera "ALBARÀ DE VENDA": ${/ALBAR[AÀ]\s+DE\s+VENDA/i.test(normalized) ? 'sí' : 'no'}`);
  hints.push(`Secció ###JOTRI_META###: ${metaMatch ? 'sí (OCR amb retalls capçalera+cos)' : 'no — parser usa text complet'}`);

  const cif = normalized.match(/\bB1720969\d\b/i);
  hints.push(cif ? `CIF JOTRI detectat: ${cif[0].toUpperCase()}` : 'CIF JOTRI (B17209693): no trobat');

  const albaraLabel = metaText.match(/Albar[aà]\b[^\d\n]{0,40}(\d{4,6})/i);
  if (albaraLabel) {
    hints.push(`Etiqueta "Albarà" + número: ${albaraLabel[1]}`);
  } else {
    hints.push('Etiqueta "Albarà" + número: no trobada a la capçalera OCR');
  }

  const vendBlock = metaText.match(/ALBAR[AÀ]\s+DE\s+VENDA([\s\S]{0,400})/i);
  if (vendBlock) {
    hints.push(`Bloc ALBARÀ DE VENDA (fragment):\n${vendBlock[0].slice(0, 200).trim()}`);
  }

  const albaCandidates = [...metaText.matchAll(/\b(\d{4,6})\b/g)]
    .map((m) => m[1])
    .filter((n) => !/^(1300|2107|2400|3100)\d{2,3}$/.test(n))
    .filter((n) => !/^(08004|08015|17462)$/.test(n));

  if (albaCandidates.length) {
    hints.push(`Números 4-6 xifres a capçalera (candidats nº albarà): ${[...new Set(albaCandidates)].slice(0, 12).join(', ')}`);
  }

  const dates = [
    ...(metaText.match(/\b\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}\b/g) || []),
    ...(metaText.match(/\b\d{6}\b/g) || []).filter((d) => {
      const day = Number(d.slice(0, 2));
      const month = Number(d.slice(2, 4));
      return day >= 1 && day <= 31 && month >= 1 && month <= 12;
    })
  ];
  hints.push(dates.length ? `Dates a capçalera: ${[...new Set(dates)].join(', ')}` : 'Dates a capçalera: cap coincidència');

  const productRefs = [...bodyText.matchAll(/\b(1300|2107|2400|3100)[\d./A-Za-z]*/gi)].map((m) => m[0]);
  hints.push(productRefs.length
    ? `Referències producte (1300/2107/…): ${[...new Set(productRefs)].slice(0, 8).join(', ')}${productRefs.length > 8 ? '…' : ''}`
    : 'Referències producte: cap detectada al cos');

  const lots = [...bodyText.matchAll(/\b(\d{5,})\s*\(\d+\)/g)].map((m) => m[1]);
  if (lots.length) hints.push(`Lots proveïdor (#####(n)): ${[...new Set(lots)].join(', ')}`);

  if (parsed?.linies?.length) {
    const sample = parsed.linies.slice(0, 3).map((l) =>
      `${l.codi || '?'} · ${l.descripcio?.slice(0, 40) || '—'} · lot ${l.lot || '—'} · ${l.quantitat || '?'} ${l.unitat || ''}`
    );
    hints.push(`Línies parsejades (mostra):\n  - ${sample.join('\n  - ')}`);
  }

  if (parsed && !parsed.lotProveidor) {
    hints.push('⚠ Nº albarà buit: revisa si algun candidat de la capçalera coincideix amb codi de producte o lot');
  }

  return hints;
}

function alvilardanSearchHints(text, parsed) {
  const normalized = String(text || '');
  const hints = [];

  hints.push(`Marcador "alvilardan.es": ${/alvilardan\.es/i.test(normalized) ? 'sí' : 'no'}`);
  hints.push(`Patró IDDOC: ${/IDDOC\d+/i.test(normalized) ? 'sí' : 'no'}`);

  const iddocSix = normalized.match(/IDDOC\d{2}(\d{6})/i);
  if (iddocSix) hints.push(`Nº albarà dins IDDOC (6 xifres): ${iddocSix[1]}`);

  const albaraSix = normalized.match(/ALBAR[AÀÁN]+[\s\S]{0,80}?(\d{6})\b/i);
  hints.push(albaraSix
    ? `Nº al costat de ALBARÁN (6 xifres): ${albaraSix[1]}`
    : 'Nº 6 xifres al costat de ALBARÁN: no trobat');

  const rutaAlba = normalized.match(/(?:Ruta|NUEVO\s+PEDIDOS)[\s\S]{0,80}?(\d{2,3}-\d{3,4})/i);
  if (rutaAlba) hints.push(`Codi Ruta/Pedidos (no és nº albarà): ${rutaAlba[1]}`);

  if (parsed?.lotProveidor) hints.push(`Nº albarà assignat pel parser: ${parsed.lotProveidor}`);

  const fechaM = normalized.match(/Fecha[:\s]*(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})/i);
  hints.push(fechaM ? `Fecha detectada: ${fechaM[1]}` : 'Fecha: no trobada');

  hints.push(/REF\s+CONCEPTO/i.test(normalized) ? 'Capçalera REF CONCEPTO: sí' : 'Capçalera REF CONCEPTO: no');

  const productLines = [...normalized.matchAll(/(\d{4,5})\s*\|\s*\(([A-Z]{2,5}\s*\d+)\)/gi)];
  if (productLines.length) {
    hints.push(`Referències producte: ${productLines.map((m) => `${m[1]} (${m[2]})`).join(', ')}`);
  }

  if (parsed?.linies?.length) {
    const sample = parsed.linies.slice(0, 3).map((l) =>
      `${l.codi || '?'} ${l.codiProveidor ? `(${l.codiProveidor})` : ''} · ${l.descripcio?.slice(0, 35) || '—'} · ${l.quantitat || '?'} ${l.unitat || ''}`
    );
    hints.push(`Línies parsejades (mostra):\n  - ${sample.join('\n  - ')}`);
  }

  if (parsed && !parsed.lotProveidor) {
    hints.push('⚠ Nº document buit; busca IDDOC######## al text OCR');
  }

  return hints;
}

function genericSearchHints(text, parsed) {
  const hints = [];
  const cifs = [...String(text || '').matchAll(/\b([A-Z]\d{8})\b/g)].map((m) => m[1]);
  if (cifs.length) hints.push(`CIFs al text: ${[...new Set(cifs)].join(', ')}`);
  if (parsed?.parserId) hints.push(`Parser seleccionat: ${parsed.parserId}`);
  return hints;
}

function makroSearchHints(text, parsed) {
  const normalized = String(text || '');
  const hints = [];
  hints.push(`Marcador "MAKRO": ${/MAKRO\s+DISTRIBUCION/i.test(normalized) ? 'sí' : 'no'}`);
  const factura = normalized.match(/Factura\s+[\d/()]+\(?(20\d{2})\)?(\d{6})/i);
  hints.push(factura ? `Nº factura Makro: ${factura[1]}${factura[2]}` : 'Nº factura Makro: no trobat');
  const fecha = normalized.match(/Fecha de (?:venta|entrega)[:\s]*(\d{1,2}\/\d{1,2}\/\d{4})/i);
  hints.push(fecha ? `Data venda/entrega: ${fecha[1]}` : 'Data: no trobada');
  const eans = [...normalized.matchAll(/\b(\d{13})\s+[A-Z]/g)].map((m) => m[1]);
  hints.push(eans.length ? `EANs producte: ${eans.slice(0, 6).join(', ')}${eans.length > 6 ? '…' : ''}` : 'Línies EAN: cap');
  if (parsed?.linies?.length) hints.push(`Línies parsejades: ${parsed.linies.length}`);
  return hints;
}

function transgourmetSearchHints(text, parsed) {
  const normalized = String(text || '');
  const hints = [];
  hints.push(`Marcador "TRANSGOURMET": ${/TRANSGOURMET/i.test(normalized) ? 'sí' : 'no'}`);
  const albara = normalized.match(/ALBARA\s+0*(\d{6,12})/i);
  hints.push(albara ? `Nº ALBARA: ${albara[1]}` : 'ALBARA: no trobat');
  const factura = normalized.match(/FACTURA\s+(20\d{10,14})/i);
  if (factura) hints.push(`Nº FACTURA (referència): ${factura[1]}`);
  const data = normalized.match(/DATA\s+(\d{1,2}[-\/.]\d{1,2}[-\/.]\d{2,4}|\d{8})/i);
  hints.push(data ? `DATA document: ${data[1]}` : 'DATA: no trobada');
  const codis = [...normalized.matchAll(/\b0*(\d{6,8})\s+[A-ZÁÉÍÓÚ]/gi)].map((m) => m[1]).slice(0, 8);
  if (codis.length) hints.push(`Codis producte (mostra): ${codis.join(', ')}`);
  if (parsed?.linies?.length) hints.push(`Línies parsejades: ${parsed.linies.length}`);
  return hints;
}

function candelasSearchHints(text, parsed) {
  const normalized = String(text || '');
  const hints = [];
  hints.push(`Marcador "CAFÉS CANDELAS": ${/CAF[ÉE]S\s+CANDELAS/i.test(normalized) ? 'sí' : 'no'}`);
  const albara = normalized.match(/N[º°o]\s*de\s*Albar[aá]n:\s*([A-Z]?\d+)/i);
  hints.push(albara ? `Nº albarà: ${albara[1]}` : 'Nº albarà: no trobat');
  const fecha = normalized.match(/Fecha:\s*(\d{1,2}\/\d{1,2}\/\d{4})/i);
  hints.push(fecha ? `Fecha: ${fecha[1]}` : 'Fecha: no trobada');
  if (parsed?.linies?.length) hints.push(`Línies parsejades: ${parsed.linies.length}`);
  return hints;
}

export function buildOcrDebugReport({ fileName = '', ocrMeta = {}, ocrText = '', parsed = null } = {}) {
  const parserId = parsed?.parserId || '—';
  const searchHints = parserId === 'multiembalajes'
    ? multiembalajesSearchHints(ocrText)
    : parserId === 'jotri'
      ? jotriSearchHints(ocrText, parsed)
      : parserId === 'alvilardan'
        ? alvilardanSearchHints(ocrText, parsed)
        : parserId === 'makro'
          ? makroSearchHints(ocrText, parsed)
          : parserId === 'transgourmet'
            ? transgourmetSearchHints(ocrText, parsed)
            : parserId === 'candelas'
              ? candelasSearchHints(ocrText, parsed)
              : genericSearchHints(ocrText, parsed);

  return {
    generatedAt: new Date().toISOString(),
    fileName,
    ocr: {
      source: ocrMeta.source || 'desconegut',
      fileType: ocrMeta.fileType || '',
      charCount: ocrMeta.charCount ?? String(ocrText || '').length,
      pageCount: ocrMeta.pageCount ?? null,
      nativeCharCount: ocrMeta.nativeCharCount ?? null,
      usedJotriRegions: Boolean(ocrMeta.usedJotriRegions),
      usedHeaderCrop: Boolean(ocrMeta.usedHeaderCrop)
    },
    parser: parsed
      ? {
          id: parsed.parserId,
          confiança: parsed.confiança,
          proveidorNom: parsed.proveidorNom || '',
          proveidorCif: parsed.proveidorCif || '',
          lotProveidor: parsed.lotProveidor || '',
          dataDocument: parsed.dataDocument || '',
          codiClient: parsed.codiClient || '',
          linies: parsed.linies?.length || 0,
          notes: parsed.notes || []
        }
      : null,
    searchHints,
    rawOcrText: String(ocrText || '')
  };
}

export function formatOcrDebugText(report) {
  if (!report) return '';

  const lines = [
    '=== LOG OCR OBRADOR ===',
    `Generat: ${report.generatedAt}`,
    `Fitxer: ${report.fileName || '—'}`,
    '',
    '--- OCR ---',
    `Origen text: ${report.ocr?.source}`,
    `Tipus fitxer: ${report.ocr?.fileType || '—'}`,
    `Caràcters llegits: ${report.ocr?.charCount}`,
    report.ocr?.pageCount != null ? `Pàgines PDF: ${report.ocr.pageCount}` : null,
    report.ocr?.nativeCharCount != null ? `Text natiu PDF (abans OCR): ${report.ocr.nativeCharCount} caràcters` : null,
    report.ocr?.usedJotriRegions ? 'Retalls JOTRI aplicats al PDF: sí' : null,
    report.ocr?.usedHeaderCrop ? 'Retall capçalera (foto): sí' : null,
    '',
    '--- PARSER ---'
  ].filter(Boolean);

  if (report.parser) {
    lines.push(
      `Parser: ${report.parser.id} (confiança ${report.parser.confiança})`,
      `Proveïdor: ${report.parser.proveidorNom || '—'}`,
      `CIF: ${report.parser.proveidorCif || '—'}`,
      `Lot / nº albarà: ${report.parser.lotProveidor || '— (no detectat)'}`,
      report.parser.codiClient ? `Codi client: ${report.parser.codiClient}` : null,
      `Data document: ${report.parser.dataDocument || '—'}`,
      `Línies producte: ${report.parser.linies}`,
      report.parser.notes?.length ? `Notes: ${report.parser.notes.join(' · ')}` : null
    );
  } else {
    lines.push('Parser: no executat');
  }

  lines.push('', '--- CERQUES / PISTES ---', ...(report.searchHints || []), '', '--- TEXT OCR (brut) ---', report.rawOcrText || '(buit)', '', '=== FI LOG ===');

  return lines.filter((l) => l !== null).join('\n');
}

export function downloadOcrDebugLog(report, baseName = 'obrador-ocr-debug') {
  const text = formatOcrDebugText(report);
  const safe = String(baseName).replace(/[^\w.-]+/g, '_').slice(0, 80);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safe}_${stamp}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}
