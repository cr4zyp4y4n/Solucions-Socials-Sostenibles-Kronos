import assert from 'node:assert/strict';
import test from 'node:test';

const { canReadFirmaPdf, getFirmaTokenAccessState } = await import('./firmaTokenAccess.ts');

test('blocks used firma tokens from viewing PDFs', () => {
  const state = getFirmaTokenAccessState({
    expires_at: new Date(Date.now() + 60_000).toISOString(),
    revoked_at: null,
    used_at: new Date().toISOString()
  });

  assert.equal(state.isUsed, true);
  assert.equal(state.canAccessDocument, false);
  assert.equal(
    canReadFirmaPdf({
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      revoked_at: null,
      used_at: new Date().toISOString()
    }),
    false
  );
});

test('allows active firma tokens to view PDFs', () => {
  assert.equal(
    canReadFirmaPdf({
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      revoked_at: null,
      used_at: null
    }),
    true
  );
});
