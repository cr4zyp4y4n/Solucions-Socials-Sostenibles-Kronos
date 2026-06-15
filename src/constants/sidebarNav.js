import {
  Home,
  FileText,
  Users,
  Settings,
  BarChart2,
  Shield,
  Activity,
  Zap,
  CreditCard,
  Calendar,
  Coffee,
  DollarSign,
  ShoppingBag,
  UploadCloud,
  Package,
  Clock,
  Briefcase,
  TrendingUp,
  Folder
} from 'feather-icons-react';

/** Definición completa del menú (clave → item). */
export const ALL_MENU_ITEMS = [
  { key: 'home', label: 'Inicio', icon: Home, roles: ['admin', 'management', 'manager', 'user', 'tienda'] },
  { key: 'analytics', label: 'Análisis', icon: BarChart2, roles: ['admin', 'management', 'manager'] },
  { key: 'catering', label: 'Catering', icon: Coffee, roles: ['admin'] },
  { key: 'sales-invoices', label: 'Resum Caterings', icon: DollarSign, roles: ['admin', 'management', 'manager'] },
  { key: 'hoja-ruta', label: 'Hoja de Ruta', icon: Calendar, roles: ['admin', 'management', 'manager'] },
  { key: 'inventory', label: 'Inventario', icon: Package, roles: ['admin', 'manager', 'tienda'] },
  { key: 'obrador', label: 'Dashboard Obrador', icon: Zap, roles: ['admin', 'management', 'manager'] },
  { key: 'gestion-tienda', label: 'Gestión Tienda', icon: ShoppingBag, roles: ['admin', 'manager', 'tienda'] },
  { key: 'empleados', label: 'Empleados', icon: Users, roles: ['admin', 'management', 'manager'] },
  { key: 'firma', label: 'Firma', icon: FileText, roles: ['admin', 'management', 'manager'] },
  { key: 'fichaje', label: 'Fichaje', icon: Clock, roles: ['admin', 'management', 'manager', 'user', 'tienda'] },
  { key: 'panel-fichajes', label: 'Panel Fichajes', icon: Activity, roles: ['admin', 'management', 'manager'] },
  { key: 'brecha-salarial', label: 'Brecha salarial', icon: BarChart2, roles: ['admin', 'management', 'manager'] },
  { key: 'pig', label: 'PIG', icon: FileText, roles: ['admin', 'management', 'manager'] },
  { key: 'subvenciones', label: 'Subvenciones', icon: FileText, roles: ['admin', 'management', 'manager'] },
  { key: 'innuva-converter', label: 'Conversor Innuva', icon: UploadCloud, roles: ['admin', 'management', 'manager'] },
  { key: 'licitacions', label: 'Licitaciones', icon: FileText, roles: ['admin', 'management', 'manager'] },
  { key: 'contacts', label: 'Contactos', icon: CreditCard, roles: ['admin', 'management', 'manager'] },
  { key: 'socios', label: 'Socios IDONI', icon: Users, roles: ['admin', 'management', 'manager', 'tienda'] },
  { key: 'users', label: 'Usuarios', icon: Shield, roles: ['admin'] },
  { key: 'audit', label: 'Auditoría', icon: Activity, roles: ['admin'] },
  { key: 'settings', label: 'Configuración', icon: Settings, roles: ['admin', 'management', 'manager', 'user', 'tienda'] }
];

/** Siempre visibles arriba (sin grupo). */
export const SIDEBAR_STANDALONE_TOP = ['home'];

/** Siempre visibles abajo del menú (sin grupo). */
export const SIDEBAR_STANDALONE_BOTTOM = ['settings'];

/** Grupos colapsables. El orden aquí es el orden en la sidebar. */
export const SIDEBAR_GROUPS = [
  {
    key: 'resumen',
    label: 'Resumen',
    icon: BarChart2,
    itemKeys: ['analytics']
  },
  {
    key: 'operaciones',
    label: 'Operaciones',
    icon: Briefcase,
    itemKeys: ['catering', 'sales-invoices', 'hoja-ruta', 'inventory', 'obrador', 'gestion-tienda']
  },
  {
    key: 'rrhh',
    label: 'RRHH',
    icon: Users,
    itemKeys: ['empleados', 'firma', 'fichaje', 'panel-fichajes', 'brecha-salarial']
  },
  {
    key: 'finanzas',
    label: 'Finanzas',
    icon: DollarSign,
    itemKeys: ['pig', 'subvenciones', 'innuva-converter']
  },
  {
    key: 'comercial',
    label: 'Comercial',
    icon: TrendingUp,
    itemKeys: ['licitacions', 'contacts', 'socios']
  },
  {
    key: 'admin',
    label: 'Administración',
    icon: Shield,
    itemKeys: ['users', 'audit']
  }
];

const ROLE_USER_MINIMAL = new Set(['home', 'fichaje', 'settings']);

function normalizeRole(role) {
  return String(role || 'user').toLowerCase();
}

function isItemVisibleForRole(item, roleNorm) {
  if (roleNorm === 'user') return ROLE_USER_MINIMAL.has(item.key);
  return item.roles.includes(roleNorm);
}

/**
 * Construye la estructura de navegación lateral según rol.
 * @returns {{ useFlat: boolean, flatItems: object[], top: object[], groups: { key, label, items: object[] }[], bottom: object[] }}
 */
export function buildSidebarNavigation(role) {
  const roleNorm = normalizeRole(role);
  const visibleByKey = new Map(
    ALL_MENU_ITEMS.filter((item) => isItemVisibleForRole(item, roleNorm)).map((item) => [item.key, item])
  );
  const flatItems = [...visibleByKey.values()];

  if (roleNorm === 'user' || flatItems.length <= 5) {
    return {
      useFlat: true,
      flatItems,
      top: [],
      groups: [],
      bottom: []
    };
  }

  const pick = (keys) => keys.map((k) => visibleByKey.get(k)).filter(Boolean);

  const top = pick(SIDEBAR_STANDALONE_TOP);
  const bottom = pick(SIDEBAR_STANDALONE_BOTTOM);
  const groupedKeys = new Set([
    ...SIDEBAR_STANDALONE_TOP,
    ...SIDEBAR_STANDALONE_BOTTOM,
    ...SIDEBAR_GROUPS.flatMap((g) => g.itemKeys)
  ]);

  const groups = SIDEBAR_GROUPS.map((g) => ({
    key: g.key,
    label: g.label,
    icon: g.icon,
    items: pick(g.itemKeys)
  })).filter((g) => g.items.length > 0);

  const orphanItems = flatItems.filter((item) => !groupedKeys.has(item.key));
  if (orphanItems.length) {
    groups.push({ key: 'otros', label: 'Otros', icon: Folder, items: orphanItems });
  }

  return { useFlat: false, flatItems, top, groups, bottom };
}

export function findMenuItemLabel(items, activeKey) {
  const found = items.find((item) => item.key === activeKey);
  return found?.label || 'SSS Kronos';
}
