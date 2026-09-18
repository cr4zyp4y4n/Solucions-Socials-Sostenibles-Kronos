import { supabaseAdmin } from '@/lib/supabase';
import type { ResolvedFirmaContext } from '@/lib/resolveFirmaToken';
import { getOtpScopeIds } from '@/lib/resolveFirmaToken';

export type IdentidadFotoStatus = {
  ok: boolean;
  path: string | null;
  at: string | null;
  hash: string | null;
};

/** Lee si ya hay foto de identidad para el envío o documento ancla. */
export async function getIdentidadFotoStatus(
  ctx: ResolvedFirmaContext
): Promise<IdentidadFotoStatus> {
  const { documentoId, envioId } = getOtpScopeIds(ctx);

  if (envioId) {
    const { data, error } = await supabaseAdmin
      .from('firma_envios')
      .select('identidad_foto_path, identidad_foto_at, identidad_foto_hash')
      .eq('id', envioId)
      .maybeSingle();
    if (error) {
      if (String(error.message || '').includes('identidad_foto')) {
        throw new Error(
          'Falta migrar identidad foto en Supabase. Ejecuta database/alter_firma_identidad_foto.sql'
        );
      }
      throw new Error(error.message);
    }
    return {
      ok: Boolean(data?.identidad_foto_path && data?.identidad_foto_at),
      path: data?.identidad_foto_path ?? null,
      at: data?.identidad_foto_at ?? null,
      hash: data?.identidad_foto_hash ?? null
    };
  }

  if (documentoId) {
    const { data, error } = await supabaseAdmin
      .from('firma_documentos')
      .select('identidad_foto_path, identidad_foto_at, identidad_foto_hash')
      .eq('id', documentoId)
      .maybeSingle();
    if (error) {
      if (String(error.message || '').includes('identidad_foto')) {
        throw new Error(
          'Falta migrar identidad foto en Supabase. Ejecuta database/alter_firma_identidad_foto.sql'
        );
      }
      throw new Error(error.message);
    }
    return {
      ok: Boolean(data?.identidad_foto_path && data?.identidad_foto_at),
      path: data?.identidad_foto_path ?? null,
      at: data?.identidad_foto_at ?? null,
      hash: data?.identidad_foto_hash ?? null
    };
  }

  return { ok: false, path: null, at: null, hash: null };
}

export async function assertIdentidadFotoPresent(ctx: ResolvedFirmaContext): Promise<IdentidadFotoStatus> {
  const status = await getIdentidadFotoStatus(ctx);
  if (!status.ok) {
    throw new Error(
      'Falta la foto de identidad (selfie con el documento delante de la cara). Complétala antes de continuar.'
    );
  }
  return status;
}
