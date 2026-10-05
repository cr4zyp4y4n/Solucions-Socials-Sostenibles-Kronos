/**
 * Auto-relleno de campos de plantilla firma.
 * Solo se rellenan las claves que existan en campos_posicion (opcionales por plantilla).
 * Coordenadas PDF: origen abajo-izquierda (como sello_posicion).
 */
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { FIRMA_EMPRESA_INFO, getFirmaEmpresaNombre } from '../constants/firmaEmpresas';

export const FIRMA_CAMPO_KEYS = [
  { key: 'nombre', label: 'Nombre' },
  { key: 'apellidos', label: 'Apellidos' },
  { key: 'dni', label: 'DNI / NIE' },
  { key: 'nombre_completo', label: 'Nombre completo (1 línea)' },
  { key: 'email', label: 'Mail / Email' },
  { key: 'telefono', label: 'Teléfono' },
  { key: 'fecha_nacimiento', label: 'Fecha nacimiento' },
  { key: 'fecha', label: 'Fecha (documento)' },
  { key: 'empresa', label: 'Empresa contratante' },
  { key: 'empresa_nif', label: 'NIF empresa' }
];

/** Formato DD/MM/YYYY. Si emptyAsToday=false y no hay valor → ''. */
export function formatFechaCampo(value, { emptyAsToday = true } = {}) {
  if (!value) {
    if (!emptyAsToday) return '';
    const d = new Date();
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}/${d.getFullYear()}`;
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const dd = String(value.getDate()).padStart(2, '0');
    const mm = String(value.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}/${value.getFullYear()}`;
  }
  const raw = String(value).trim();
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(raw)) return raw;
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return raw;
}

export function splitNombreApellidos(nombreCompleto) {
  const raw = String(nombreCompleto || '').trim().replace(/\s+/g, ' ');
  if (!raw) return { nombre: '', apellidos: '', nombre_completo: '' };
  const parts = raw.split(' ');
  if (parts.length === 1) {
    return { nombre: parts[0], apellidos: '', nombre_completo: raw };
  }
  if (parts.length === 2) {
    return { nombre: parts[0], apellidos: parts[1], nombre_completo: raw };
  }
  // Convención habitual ES: dos últimos tokens = apellidos
  return {
    nombre: parts.slice(0, -2).join(' '),
    apellidos: parts.slice(-2).join(' '),
    nombre_completo: raw
  };
}

export function normalizeCampoPosicion(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const pageIndex = Math.floor(Number(raw.pageIndex));
  const x = Number(raw.x);
  const y = Number(raw.y);
  const width = Number(raw.width);
  const height = Number(raw.height);
  const fontSize = Number(raw.fontSize);
  if (![pageIndex, x, y, width, height].every((n) => Number.isFinite(n))) return null;
  if (pageIndex < 0 || width < 20 || height < 8) return null;
  return {
    pageIndex,
    x,
    y,
    width: Math.min(Math.max(width, 20), 500),
    height: Math.min(Math.max(height, 8), 40),
    fontSize: Number.isFinite(fontSize) && fontSize >= 6 && fontSize <= 18 ? fontSize : undefined
  };
}

/** @returns {Record<string, ReturnType<typeof normalizeCampoPosicion>>} */
export function normalizeCamposPosicion(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out = {};
  for (const { key } of FIRMA_CAMPO_KEYS) {
    const n = normalizeCampoPosicion(raw[key]);
    if (n) out[key] = n;
  }
  return out;
}

function toWinAnsiSafe(text) {
  return String(text || '')
    .replace(/\u2022/g, '·')
    .replace(/\u2026/g, '...')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u00A0/g, ' ');
}

/**
 * Dibuja solo los campos presentes en campos_posicion.
 * @param {object} [ctx] trabajador + entityKey / empresa / empresaNif
 * @returns {Promise<Uint8Array>}
 */
export async function fillPlantillaPdfBytes(pdfBytes, camposPosicion, ctx = {}) {
  const campos = normalizeCamposPosicion(camposPosicion);
  const keys = Object.keys(campos);
  if (!keys.length) {
    return pdfBytes instanceof Uint8Array ? pdfBytes : new Uint8Array(pdfBytes);
  }

  const entityKey = ctx.entityKey || ctx.entity_key || '';
  const empresaInfo = FIRMA_EMPRESA_INFO[entityKey] || null;
  const splitFromFull = splitNombreApellidos(ctx.nombreCompleto || '');
  const nombre =
    String(ctx.nombreHolded || ctx.nombreSolo || '').trim() ||
    (ctx.nombreCompleto ? splitFromFull.nombre : '') ||
    splitNombreApellidos(ctx.nombre || '').nombre;
  const apellidos =
    String(ctx.apellidos || '').trim() ||
    (ctx.nombreCompleto ? splitFromFull.apellidos : '') ||
    splitNombreApellidos(ctx.nombre || '').apellidos;
  const nombreCompleto =
    String(ctx.nombreCompleto || '').trim() ||
    [nombre, apellidos].filter(Boolean).join(' ') ||
    String(ctx.nombre || '').trim();

  const values = {
    nombre,
    apellidos,
    nombre_completo: nombreCompleto,
    dni: String(ctx.dni || '').trim(),
    email: String(ctx.email || ctx.mail || '').trim(),
    telefono: String(ctx.telefono || ctx.phone || '').trim(),
    fecha_nacimiento: formatFechaCampo(
      ctx.fechaNacimiento || ctx.fecha_nacimiento || '',
      { emptyAsToday: false }
    ),
    fecha: formatFechaCampo(ctx.fecha || ctx.fechaInicio || ''),
    empresa: String(ctx.empresa || getFirmaEmpresaNombre(entityKey) || '').trim(),
    empresa_nif: String(ctx.empresaNif || ctx.empresa_nif || empresaInfo?.nif || '').trim()
  };

  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const pages = pdfDoc.getPages();
  if (!pages.length) throw new Error('PDF plantilla sin páginas');

  for (const key of keys) {
    const box = campos[key];
    const text = toWinAnsiSafe(values[key] || '');
    if (!text) continue;
    const page = pages[Math.min(Math.max(0, box.pageIndex), pages.length - 1)];
    const size = box.fontSize || Math.min(11, Math.max(7, box.height * 0.72));
    // Baseline cerca del borde inferior del recuadro (líneas de formulario)
    const textY = box.y + Math.max(1.5, (box.height - size) * 0.15);
    const maxWidth = box.width;
    let draw = text;
    while (draw.length > 1 && font.widthOfTextAtSize(draw, size) > maxWidth) {
      draw = `${draw.slice(0, -2)}...`;
    }
    page.drawText(draw, {
      x: box.x,
      y: textY,
      size,
      font,
      color: rgb(0.05, 0.05, 0.05),
      maxWidth
    });
  }

  return pdfDoc.save();
}

/** Aplica campos a un File/Blob PDF y devuelve un File nuevo. Sin campos → file intacto. */
export async function fillPlantillaPdfFile(file, camposPosicion, ctx = {}) {
  const campos = normalizeCamposPosicion(camposPosicion);
  if (!Object.keys(campos).length) return file;
  const buf = await file.arrayBuffer();
  const filled = await fillPlantillaPdfBytes(new Uint8Array(buf), campos, ctx);
  const name = file.name || 'documento.pdf';
  return new File([filled], name.endsWith('.pdf') ? name : `${name}.pdf`, {
    type: 'application/pdf'
  });
}
