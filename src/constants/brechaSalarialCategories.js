/** Ordre de blocs al full de Sergi (plantilla 2026 EISSS). */
export const BRECHA_CATEGORIA_ORDER = [
  'DIRECCION',
  'PERSONAL TECNIC',
  'ADMINISTRACIÓ',
  'CATERING',
  'OTROS'
];

/** Valors d'equip a Holded (camp equip / team) → categoria de la taula. */
const EQUIPO_TO_CATEGORIA = [
  { match: ['catering'], categoria: 'CATERING' },
  { match: ['direccion', 'direccio', 'direcci'], categoria: 'DIRECCION' },
  { match: ['tecnic', 'tecnico', 'personal tecnic', 'personal tecnico'], categoria: 'PERSONAL TECNIC' },
  { match: ['admin', 'administracio', 'administracion', 'administraci'], categoria: 'ADMINISTRACIÓ' }
];

/** 48 setmanes laborals / any (plantilla Sergi: 40h × 48 = 1920 h). */
export const BRECHA_SEMANAS_ANUAL = 48;

/** Fracció setmanes/mes (notes Lizeth al CSV). */
export const BRECHA_SEMANAS_MES = 4.33;

function normKey(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Mapeja el text de l'equip Holded a la categoria del registre de brecha.
 */
export function categoriaFromHoldedEquipo(equipoRaw) {
  const t = normKey(equipoRaw);
  if (!t) return null;
  for (const rule of EQUIPO_TO_CATEGORIA) {
    if (rule.match.some((m) => t === m || t.includes(m))) return rule.categoria;
  }
  return 'OTROS';
}

/**
 * Reserva: només si no hi ha equip a Holded (no s'ha d'usar com a font principal).
 */
export function inferCategoriaFuncion(puesto = '', departamento = '') {
  const t = `${puesto} ${departamento}`.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (/direc|gerent|ceo|presid|junta|director/.test(t)) return 'DIRECCION';
  if (/cater|cuina|cocina|hostel|sala|cambrer|cuiner/.test(t)) return 'CATERING';
  if (/admin|compta|rrhh|oficina|secretar|recepc/.test(t)) return 'ADMINISTRACIÓ';
  if (/tecnic|inform|program|sistem|manten|enginy/.test(t)) return 'PERSONAL TECNIC';
  return 'OTROS';
}
