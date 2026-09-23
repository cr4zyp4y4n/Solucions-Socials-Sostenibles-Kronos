/**
 * Flujo actual (post PAdES):
 * 1) SHA-256 del PDF original (bytes intactos).
 * 2) pdf-lib: página nueva "Hoja de evidencias…" (sin dibujar sobre páginas originales).
 * 3) Placeholder PAdES + save({ useObjectStreams: false }).
 * 4) @signpdf firma con P12 (servidor Node; nunca en Electron).
 * 5) Tras firmar no se modifica el PDF.
 *
 * Antes: stampPdfLastPage dibujaba un recuadro verde "Aceptación electrónica (Kronos)"
 * encima de la última página (sin firma criptográfica; podía tapar pies de página).
 */
import { createHash } from 'crypto';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { pdflibAddPlaceholder } from '@signpdf/placeholder-pdf-lib';
import { P12Signer } from '@signpdf/signer-p12';
import signpdf from '@signpdf/signpdf';
import { SUBFILTER_ETSI_CADES_DETACHED } from '@signpdf/utils';
import forge from 'node-forge';
import {
  buildAceptacionRespuestaLine,
  getFirmaDocMeta,
  normalizeRespuestaAceptacion,
  type DocOpciones
} from '@/lib/firmaDocumentosMeta';
import { formatMadridDateTime } from '@/lib/madridDate';
import { getFirmaEmpresaInfo } from '@/lib/firmaEmpresas';

export type SealPdfEvidenceArgs = {
  pdfBytes: Uint8Array;
  /** Hash conocido en BD (opcional); si no coincide con el calculado, gana el calculado. */
  hashPdfKnown?: string | null;
  tipoDocumento: string;
  opciones?: DocOpciones | null;
  documentoId: string;
  tokenRowId: string;
  nowIso: string;
  ip?: string;
  userAgent?: string;
  trabajadorNombre?: string | null;
  trabajadorDni?: string | null;
  telefonoOtp?: string | null;
  dniConfirmadoEnPortal?: boolean;
  identidadFotoAt?: string | null;
  smsVerificadoAt?: string | null;
  entityKey?: string | null;
  documentoTitulo?: string | null;
  fileName?: string | null;
};

export type SealPdfEvidenceResult = {
  signedPdf: Uint8Array;
  sha256Original: string;
  sha256Firmado: string;
  sealCertSerial: string | null;
  sealCertIssuer: string | null;
  originalPageCount: number;
  /** Env usada: SOLUCIONS | MENJAR | DEFAULT */
  sealEnvProfile: 'SOLUCIONS' | 'MENJAR' | 'DEFAULT';
};

export function sha256HexOfBytes(bytes: Uint8Array | Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/** Enmascara teléfono OTP: `+34 6·· ··· 412` (middot WinAnsi, no bullet). */
export function maskTelefonoOtp(raw?: string | null): string {
  const s = String(raw || '').trim();
  if (!s) return '';
  const digits = s.replace(/\D/g, '');
  if (digits.length < 6) return '········';

  let prefix = '';
  let local = digits;
  if (digits.startsWith('34') && digits.length >= 11) {
    prefix = '+34 ';
    local = digits.slice(2);
  } else if (s.startsWith('+') && digits.length > 9) {
    const ccLen = digits.length - 9;
    prefix = `+${digits.slice(0, Math.max(1, ccLen))} `;
    local = digits.slice(Math.max(1, ccLen));
  }

  if (local.length >= 9) {
    return `${prefix}${local[0]}·· ··· ${local.slice(-3)}`;
  }
  return `${prefix}${local[0]}${'·'.repeat(Math.max(2, local.length - 4))} ${local.slice(-3)}`;
}

function wrapLine(text: string, maxChars: number): string[] {
  const t = String(text || '');
  if (!t) return [];
  if (t.length <= maxChars) return [t];
  const out: string[] = [];
  for (let i = 0; i < t.length; i += maxChars) {
    out.push(t.slice(i, i + maxChars));
  }
  return out;
}

/** Helvetica WinAnsi: evita caracteres que rompen drawText (bullet, ellipsis…). */
function toWinAnsiSafe(text: string): string {
  return String(text || '')
    .replace(/\u2022/g, '·') // •
    .replace(/\u2026/g, '...') // …
    .replace(/[\u2013\u2014]/g, '-') // – —
    .replace(/\u00A0/g, ' ');
}

type SealEnvProfile = 'SOLUCIONS' | 'MENJAR' | 'DEFAULT';

function resolveSealEnvProfile(entityKey?: string | null): SealEnvProfile {
  const key = String(entityKey || '').trim().toUpperCase();
  if (key === 'EI_SSS' || key === 'SOLUCIONS' || key === 'EISSS') return 'SOLUCIONS';
  if (key === 'MENJAR_DHORT' || key === 'MENJAR' || key === 'MH') return 'MENJAR';
  return 'DEFAULT';
}

/**
 * Netlify limita valores secretos a 5000 chars. Un PFX en Base64 suele ser más largo:
 * KRONOS_SEAL_P12_BASE64_SOLUCIONS_1, _2, _3… (o la clave sin sufijo si cabe en una).
 */
function readBase64Parts(baseKey: string): string {
  const part1 = String(process.env[`${baseKey}_1`] || '').trim();
  if (part1) {
    const chunks: string[] = [part1];
    for (let i = 2; i <= 20; i++) {
      const chunk = String(process.env[`${baseKey}_${i}`] || '').trim();
      if (!chunk) break;
      chunks.push(chunk);
    }
    return chunks.join('');
  }
  return String(process.env[baseKey] || '').trim();
}

/**
 * Elige P12 según entidad del envío.
 * Preferencia: …_SOLUCIONS / …_MENJAR → fallback KRONOS_SEAL_P12_* genérico.
 * Base64 puede ir partido en _1, _2, _3… (límite Netlify 5000).
 */
function loadP12FromEnv(entityKey?: string | null): {
  p12: Buffer;
  passphrase: string;
  profile: SealEnvProfile;
} {
  const profile = resolveSealEnvProfile(entityKey);

  const candidates: Array<{ profile: SealEnvProfile; b64Key: string; passKey: string }> = [];
  if (profile === 'SOLUCIONS') {
    candidates.push({
      profile: 'SOLUCIONS',
      b64Key: 'KRONOS_SEAL_P12_BASE64_SOLUCIONS',
      passKey: 'KRONOS_SEAL_P12_PASS_SOLUCIONS'
    });
  } else if (profile === 'MENJAR') {
    candidates.push({
      profile: 'MENJAR',
      b64Key: 'KRONOS_SEAL_P12_BASE64_MENJAR',
      passKey: 'KRONOS_SEAL_P12_PASS_MENJAR'
    });
  }
  candidates.push({
    profile: 'DEFAULT',
    b64Key: 'KRONOS_SEAL_P12_BASE64',
    passKey: 'KRONOS_SEAL_P12_PASS'
  });

  for (const c of candidates) {
    const b64 = readBase64Parts(c.b64Key);
    if (!b64) continue;
    const p12 = Buffer.from(b64, 'base64');
    if (!p12.length) {
      throw new Error(`${c.b64Key} inválido (buffer vacío)`);
    }
    return {
      p12,
      passphrase: String(process.env[c.passKey] || ''),
      profile: c.profile
    };
  }

  const hint =
    profile === 'SOLUCIONS'
      ? 'KRONOS_SEAL_P12_BASE64_SOLUCIONS_1/_2/… (o KRONOS_SEAL_P12_BASE64)'
      : profile === 'MENJAR'
        ? 'KRONOS_SEAL_P12_BASE64_MENJAR_1/_2/… (o KRONOS_SEAL_P12_BASE64)'
        : 'KRONOS_SEAL_P12_BASE64_1/_2/…';
  throw new Error(
    `${hint} no configurado. Sin certificado FNMT de sello no se puede cerrar el PDF con PAdES.`
  );
}

function extractCertInfo(p12Buffer: Buffer, passphrase: string): {
  serial: string | null;
  issuer: string | null;
} {
  try {
    const asn1 = forge.asn1.fromDer(p12Buffer.toString('binary'));
    const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, passphrase || undefined);
    const bags = p12.getBags({ bagType: forge.pki.oids.certBag });
    const bag = bags[forge.pki.oids.certBag]?.[0];
    const cert = bag?.cert;
    if (!cert) return { serial: null, issuer: null };
    const serial = String(cert.serialNumber || '') || null;
    const issuer =
      cert.issuer?.attributes
        ?.map((a) => `${a.shortName || a.name}=${a.value}`)
        .join(', ') || null;
    return { serial, issuer };
  } catch {
    return { serial: null, issuer: null };
  }
}

function buildEvidenceBlocks(args: SealPdfEvidenceArgs & {
  sha256Original: string;
  originalPageCount: number;
  razonSocial: string;
  nif: string;
}): string[] {
  const meta = getFirmaDocMeta(args.tipoDocumento);
  const respuesta = normalizeRespuestaAceptacion(args.opciones);
  const docTitulo =
    String(args.documentoTitulo || '').trim() ||
    meta.stampDeclaration ||
    String(args.fileName || 'Documento');
  const docRef = args.documentoId.replace(/-/g, '').slice(0, 12);
  const tokenRef = args.tokenRowId.replace(/-/g, '').slice(0, 12);
  const telMasked = maskTelefonoOtp(args.telefonoOtp);

  const lines: string[] = [
    `Emisor: ${args.razonSocial}${args.nif ? ` · NIF ${args.nif}` : ''}`,
    `Documento: ${docTitulo}`,
    `Páginas del original: ${args.originalPageCount}`,
    `Referencia documento: ${docRef || args.documentoId}`,
    ''
  ];

  if (respuesta) {
    lines.push(`Declaración aceptada: ${buildAceptacionRespuestaLine(args.tipoDocumento, respuesta)}`);
  } else {
    lines.push(`Declaración: ${meta.stampDeclaration}`);
  }

  if (args.tipoDocumento === 'acoso' && args.opciones?.formacion_acoso) {
    lines.push('Solicita formación PREVENCION DEL ACOSO: Sí');
  }

  lines.push('');
  lines.push(`Trabajador: ${args.trabajadorNombre || '—'}`);
  lines.push(`DNI: ${args.trabajadorDni || '—'}`);
  lines.push('');
  lines.push(
    `DNI confirmado en portal: ${args.dniConfirmadoEnPortal ? 'Sí' : 'No'}${
      args.dniConfirmadoEnPortal ? '' : ''
    }`
  );
  lines.push(
    args.identidadFotoAt
      ? `Foto de identidad recibida: Sí · ${formatMadridDateTime(args.identidadFotoAt)}`
      : 'Foto de identidad recibida: No'
  );
  lines.push(
    args.smsVerificadoAt
      ? `OTP completada: Sí · ${formatMadridDateTime(args.smsVerificadoAt)}`
      : 'OTP completada: Sí'
  );
  if (telMasked) {
    lines.push(`Teléfono OTP: ${telMasked}`);
  }
  lines.push(`Fecha/hora de firma: ${formatMadridDateTime(args.nowIso)}`);
  lines.push('');
  lines.push('SHA-256 del PDF original:');
  lines.push(...wrapLine(args.sha256Original, 64));
  lines.push('');
  lines.push(`Ref. documento: ${docRef || '—'} · Token: ${tokenRef || '—'}`);
  if (args.ip) lines.push(`IP: ${args.ip}`);
  if (args.userAgent) {
    lines.push('User-Agent:');
    lines.push(...wrapLine(args.userAgent, 90));
  }
  lines.push('');
  lines.push(
    `Tipo de firma: Firma electrónica simple · verificación por SMS · documento sellado electrónicamente por ${args.razonSocial}`
  );

  return lines.map(toWinAnsiSafe);
}

/**
 * Construye PDF con hoja de evidencias + sello PAdES (certificado de entorno).
 */
export async function sealPdfWithEvidence(args: SealPdfEvidenceArgs): Promise<SealPdfEvidenceResult> {
  const sha256Original = sha256HexOfBytes(args.pdfBytes);
  if (args.hashPdfKnown && String(args.hashPdfKnown).toLowerCase() !== sha256Original) {
    // Preferimos el hash real de los bytes descargados (fuente de verdad del PDF sellado).
    console.warn(
      `[pdfSign] hash_pdf en BD (${args.hashPdfKnown}) != SHA-256 bytes (${sha256Original}); se usa el calculado.`
    );
  }

  const pdfDoc = await PDFDocument.load(args.pdfBytes, { ignoreEncryption: true });
  const pages = pdfDoc.getPages();
  if (!pages.length) throw new Error('PDF sin páginas');

  const originalPageCount = pages.length;
  const lastPage = pages[pages.length - 1];
  const { width, height } = lastPage.getSize();

  const evidencePage = pdfDoc.addPage([width, height]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const empresa = getFirmaEmpresaInfo(args.entityKey);
  const razonSocial = empresa?.nombre || 'Emisor';
  const nif = empresa?.nif || '';

  const blocks = buildEvidenceBlocks({
    ...args,
    sha256Original,
    originalPageCount,
    razonSocial,
    nif
  });

  const margin = 48;
  const title = toWinAnsiSafe('Hoja de evidencias de aceptación electrónica');
  let y = height - margin;
  evidencePage.drawText(title, {
    x: margin,
    y: y - 14,
    size: 14,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1)
  });
  y -= 36;

  const bodySize = 9;
  const lineGap = 12;
  const maxWidthChars = Math.floor((width - margin * 2) / (bodySize * 0.5));

  for (const raw of blocks) {
    if (!raw) {
      y -= lineGap * 0.6;
      continue;
    }
    const wrapped = wrapLine(raw, Math.max(40, maxWidthChars));
    for (const line of wrapped) {
      if (y < margin + 24) break;
      evidencePage.drawText(line, {
        x: margin,
        y: y - bodySize,
        size: bodySize,
        font,
        color: rgb(0.12, 0.12, 0.12)
      });
      y -= lineGap;
    }
  }

  const docTituloMeta =
    String(args.documentoTitulo || '').trim() ||
    getFirmaDocMeta(args.tipoDocumento).stampDeclaration ||
    String(args.fileName || 'Documento firmado');
  const docRef = args.documentoId.replace(/-/g, '').slice(0, 12);

  pdfDoc.setTitle(toWinAnsiSafe(docTituloMeta));
  pdfDoc.setSubject('Acuse de recibo firmado electrónicamente');
  pdfDoc.setKeywords([docRef, sha256Original].filter(Boolean));
  pdfDoc.setProducer('Kronos');
  pdfDoc.setCreator('Kronos · portal-firma');

  const { p12, passphrase, profile: sealEnvProfile } = loadP12FromEnv(args.entityKey);
  const certInfo = extractCertInfo(p12, passphrase);

  pdflibAddPlaceholder({
    pdfDoc,
    reason: toWinAnsiSafe(
      `Acuse de recibo electrónico – ref. ${docRef || args.documentoId}`
    ),
    contactInfo: nif ? `NIF ${nif}` : razonSocial,
    name: toWinAnsiSafe(razonSocial),
    location: 'Barcelona',
    subFilter: SUBFILTER_ETSI_CADES_DETACHED
  });

  const prepared = Buffer.from(await pdfDoc.save({ useObjectStreams: false }));
  const signer = new P12Signer(p12, { passphrase });
  const signedBuffer = await signpdf.sign(prepared, signer);
  const signedPdf = new Uint8Array(signedBuffer);
  const sha256Firmado = sha256HexOfBytes(signedPdf);

  return {
    signedPdf,
    sha256Original,
    sha256Firmado,
    sealCertSerial: certInfo.serial,
    sealCertIssuer: certInfo.issuer,
    originalPageCount,
    sealEnvProfile
  };
}

/** @deprecated Usar sealPdfWithEvidence. Mantenido por si algún import residual. */
export async function stampPdfLastPage({
  pdfBytes,
  stampLines
}: {
  pdfBytes: Uint8Array;
  stampLines: string[];
}): Promise<Uint8Array> {
  void stampLines;
  throw new Error(
    'stampPdfLastPage está retirado: usar sealPdfWithEvidence (hoja de evidencias + PAdES).'
  );
}
