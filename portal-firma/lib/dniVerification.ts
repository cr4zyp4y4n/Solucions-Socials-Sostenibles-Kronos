import { supabaseAdmin } from '@/lib/supabase';
import { sha256Hex } from '@/lib/otp';
import { dniMatches, normalizeDni } from '@/lib/normalizeDni';

export type DniCheckResult =
  | { required: false }
  | { required: true; ok: true; dniHash: string }
  | { required: true; ok: false };

export function checkProvidedDni(
  expectedDni: string | null | undefined,
  providedDni: string | null | undefined
): DniCheckResult {
  const expected = normalizeDni(expectedDni);
  if (!expected) return { required: false };

  const provided = normalizeDni(providedDni);
  if (!provided || !dniMatches(expected, provided)) {
    return { required: true, ok: false };
  }

  return { required: true, ok: true, dniHash: sha256Hex(expected) };
}

export async function hasRecentDniConfirmation({
  documentoId,
  envioId,
  withinMinutes = 35
}: {
  documentoId: string;
  envioId?: string | null;
  withinMinutes?: number;
}): Promise<boolean> {
  const sinceIso = new Date(Date.now() - withinMinutes * 60 * 1000).toISOString();
  const { data, error } = await supabaseAdmin
    .from('firma_auditorias')
    .select('id, detalle, created_at')
    .eq('documento_id', documentoId)
    .eq('resultado', 'ok')
    .gte('created_at', sinceIso)
    .order('created_at', { ascending: false })
    .limit(30);

  if (error) return false;

  return (data || []).some((row) => {
    const det = row.detalle as { accion?: string; envio_id?: string } | null;
    if (det?.accion !== 'dni_confirmado') return false;
    if (envioId && det.envio_id && det.envio_id !== envioId) return false;
    return true;
  });
}
