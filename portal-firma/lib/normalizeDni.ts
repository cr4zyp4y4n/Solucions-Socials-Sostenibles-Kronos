/** Normaliza DNI/NIE español para comparación (sin espacios, guiones, mayúsculas). */
export function normalizeDni(value: string | null | undefined): string {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[\s.-]/g, '');
}

export function dniMatches(
  expected: string | null | undefined,
  provided: string | null | undefined
): boolean {
  const a = normalizeDni(expected);
  const b = normalizeDni(provided);
  if (!a || !b) return false;
  return a === b;
}
