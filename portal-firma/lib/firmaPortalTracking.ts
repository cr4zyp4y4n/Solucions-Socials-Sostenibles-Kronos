import { resolveFirmaToken } from '@/lib/resolveFirmaToken';
import { supabaseAdmin } from '@/lib/supabase';

export type MarcarPortalAbiertoResult =
  | { ok: true; skipped: boolean }
  | { ok: false; error: string };

/**
 * Primera apertura válida del portal para un token: rellena portal_abierto_at (idempotente).
 */
export async function marcarPortalAbiertoSiCorresponde(token: string): Promise<MarcarPortalAbiertoResult> {
  const trimmed = String(token || '').trim();
  if (!trimmed) return { ok: false, error: 'Falta token' };

  let resolved;
  try {
    resolved = await resolveFirmaToken(trimmed);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }

  if (!resolved) return { ok: false, error: 'Token no válido' };
  if (
    resolved.isExpired ||
    resolved.isRevoked ||
    resolved.envio?.estado === 'cancelado' ||
    resolved.envio?.estado === 'firmado' ||
    resolved.documentoPrincipal?.estado === 'cancelado' ||
    resolved.documentoPrincipal?.estado === 'firmado'
  ) {
    return { ok: true, skipped: true };
  }

  const nowIso = new Date().toISOString();

  if (resolved.envio?.id) {
    const { error: upErr } = await supabaseAdmin
      .from('firma_envios')
      .update({ portal_abierto_at: nowIso, updated_at: nowIso })
      .eq('id', resolved.envio.id)
      .is('portal_abierto_at', null);
    if (upErr) return { ok: false, error: upErr.message };
    return { ok: true, skipped: false };
  }

  const docId = resolved.documentoPrincipal?.id;
  if (!docId) return { ok: false, error: 'Documento no encontrado' };

  const { error: upErr } = await supabaseAdmin
    .from('firma_documentos')
    .update({ portal_abierto_at: nowIso })
    .eq('id', docId)
    .is('portal_abierto_at', null);

  if (upErr) return { ok: false, error: upErr.message };
  return { ok: true, skipped: false };
}
