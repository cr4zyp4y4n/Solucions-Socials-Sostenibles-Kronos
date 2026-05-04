/**
 * Los nested selects de Supabase suelen tiparse como T | T[].
 * Normaliza a un solo objeto para acceder a propiedades sin error de TS.
 */
export function asSingle<T>(rel: T | T[] | null | undefined): T | undefined {
  if (rel == null) return undefined;
  return Array.isArray(rel) ? (rel[0] as T) : rel;
}
