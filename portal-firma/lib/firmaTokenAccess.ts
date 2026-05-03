type FirmaTokenAccessRow = {
  expires_at?: string | null;
  revoked_at?: string | null;
  used_at?: string | null;
};

export function getFirmaTokenBlockReason(tokenRow: FirmaTokenAccessRow) {
  if (isFirmaTokenExpired(tokenRow)) return 'expired';
  if (tokenRow.revoked_at) return 'revoked';
  if (tokenRow.used_at) return 'used';
  return null;
}

export function getFirmaTokenAccessState(tokenRow: FirmaTokenAccessRow) {
  const isExpired = isFirmaTokenExpired(tokenRow);
  const isRevoked = !!tokenRow.revoked_at;
  const isUsed = !!tokenRow.used_at;

  return {
    isExpired,
    isRevoked,
    isUsed,
    canAccessDocument: !isExpired && !isRevoked && !isUsed
  };
}

export function isFirmaTokenBlocked(tokenRow: FirmaTokenAccessRow) {
  return getFirmaTokenBlockReason(tokenRow) !== null;
}

export function canReadFirmaPdf(tokenRow: FirmaTokenAccessRow) {
  return !isFirmaTokenBlocked(tokenRow);
}

function isFirmaTokenExpired(tokenRow: FirmaTokenAccessRow) {
  const expiresAt = new Date(tokenRow.expires_at || '');
  return Number.isFinite(expiresAt.getTime()) && expiresAt.getTime() < Date.now();
}
