const STORAGE_VERSION = 'v1';

function storageKey(company) {
  return `kronos.brechaCategoria.${STORAGE_VERSION}.${company || 'solucions'}`;
}

/** Categorías guardadas manualmente: { [holdedEmployeeId]: 'CATERING' | ... } */
export function loadBrechaCategorias(company) {
  try {
    const raw = localStorage.getItem(storageKey(company));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function saveBrechaCategorias(company, map) {
  try {
    localStorage.setItem(storageKey(company), JSON.stringify(map || {}));
  } catch {
    /* quota / private mode */
  }
}

export function setBrechaCategoria(company, employeeId, categoria) {
  const id = String(employeeId || '').trim();
  if (!id) return loadBrechaCategorias(company);
  const prev = loadBrechaCategorias(company);
  const next = { ...prev, [id]: categoria };
  saveBrechaCategorias(company, next);
  return next;
}
