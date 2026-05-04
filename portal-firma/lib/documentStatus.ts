const INACTIVE_DOCUMENT_STATES = new Set(['cancelado', 'caducado']);

export function getInactiveDocumentStateError(estado: unknown): string | undefined {
  const normalized = String(estado || '').trim().toLowerCase();
  if (!INACTIVE_DOCUMENT_STATES.has(normalized)) return undefined;
  if (normalized === 'cancelado') return 'Documento cancelado';
  if (normalized === 'caducado') return 'Documento caducado';
  return undefined;
}

export function getSigningBlockedDocumentStateError(estado: unknown): string | undefined {
  const inactiveError = getInactiveDocumentStateError(estado);
  if (inactiveError) return inactiveError;
  const normalized = String(estado || '').trim().toLowerCase();
  if (normalized === 'firmado') return 'Documento ya firmado';
  return undefined;
}
