import { supabaseAdmin } from '@/lib/supabase';
import { asSingle } from '@/lib/relation';

export type MarcarPortalAbiertoResult =
  | { ok: true; skipped: boolean }
  | { ok: false; error: string };

/**
 * Primera apertura válida del portal para un token: rellena portal_abierto_at (idempotente).
 * Requiere service role en el cliente de Supabase del portal; sin ella RLS suele bloquear el UPDATE.
 */
export async function marcarPortalAbiertoSiCorresponde(token: string): Promise<MarcarPortalAbiertoResult> {
  const trimmed = String(token || '').trim();
  if (!trimmed) return { ok: false, error: 'Falta token' };

  const { data: tokenRow, error: tokenError } = await supabaseAdmin
    .from('firma_tokens')
    .select(
      `
      id,
      expires_at,
      revoked_at,
      documento:firma_documentos!firma_tokens_documento_id_fkey (
        id,
        estado
      )
    `
    )
    .eq('token', trimmed)
    .maybeSingle();

  if (tokenError) return { ok: false, error: tokenError.message };
  if (!tokenRow) return { ok: false, error: 'Token no válido' };

  const expiresAt = new Date(tokenRow.expires_at);
  const isExpired = Number.isFinite(expiresAt.getTime()) && expiresAt.getTime() < Date.now();
  const isRevoked = !!tokenRow.revoked_at;
  const documento = asSingle(tokenRow.documento);
  if (!documento?.id) return { ok: false, error: 'Documento no encontrado' };

  if (isExpired || isRevoked || documento.estado === 'cancelado' || documento.estado === 'firmado') {
    return { ok: true, skipped: true };
  }

  const nowIso = new Date().toISOString();
  const { error: upErr } = await supabaseAdmin
    .from('firma_documentos')
    .update({ portal_abierto_at: nowIso })
    .eq('id', documento.id)
    .is('portal_abierto_at', null);

  if (upErr) return { ok: false, error: upErr.message };
  return { ok: true, skipped: false };
}
