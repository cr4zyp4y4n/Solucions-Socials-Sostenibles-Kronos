import { createHash } from 'crypto';
import { getOtpScopeIds, resolveFirmaToken } from '@/lib/resolveFirmaToken';
import { getIdentidadFotoStatus } from '@/lib/identidadVerification';
import { getRequestInfo } from '@/lib/requestInfo';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';

const BUCKET = 'firma-documentos';
const MAX_BYTES = 6 * 1024 * 1024; // 6 MB
const ALLOWED = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);

function extensionFor(mime: string) {
  if (mime.includes('png')) return 'png';
  if (mime.includes('webp')) return 'webp';
  return 'jpg';
}

export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const resolved = await resolveFirmaToken(token);
  if (!resolved) return Response.json({ ok: false, error: 'Token no válido' }, { status: 404 });
  try {
    const status = await getIdentidadFotoStatus(resolved);
    return Response.json({
      ok: true,
      hasFoto: status.ok,
      at: status.at
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error consultando foto de identidad';
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const resolved = await resolveFirmaToken(token);
  if (!resolved) return Response.json({ ok: false, error: 'Token no válido' }, { status: 404 });
  if (resolved.isExpired || resolved.isRevoked || resolved.isUsed) {
    return Response.json({ ok: false, error: 'Token caducado, revocado o usado' }, { status: 410 });
  }

  const { documentoId, envioId } = getOtpScopeIds(resolved);
  if (!documentoId) {
    return Response.json({ ok: false, error: 'Documento no encontrado' }, { status: 404 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ ok: false, error: 'Formulario inválido' }, { status: 400 });
  }

  const file = form.get('foto');
  if (!file || typeof file === 'string') {
    return Response.json({ ok: false, error: 'Falta la foto (campo foto)' }, { status: 400 });
  }

  const blob = file as File;
  const mime = String(blob.type || 'image/jpeg').toLowerCase();
  if (!ALLOWED.has(mime)) {
    return Response.json(
      { ok: false, error: 'Formato no permitido. Usa JPG, PNG o WEBP.' },
      { status: 400 }
    );
  }
  if (blob.size <= 0 || blob.size > MAX_BYTES) {
    return Response.json(
      { ok: false, error: 'La foto debe pesar entre 1 byte y 6 MB.' },
      { status: 400 }
    );
  }

  const aceptaUso = String(form.get('acepta_uso_verificacion') || '') === 'true';
  if (!aceptaUso) {
    return Response.json(
      {
        ok: false,
        error: 'Debes aceptar que la imagen se usa para verificación de identidad y se guarda en nuestros sistemas.'
      },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await blob.arrayBuffer());
  const hash = createHash('sha256').update(buffer).digest('hex');
  const ext = extensionFor(mime);
  const scope = envioId || documentoId;
  const storagePath = `identidad/${scope}/${Date.now()}-selfie.${ext}`;
  const nowIso = new Date().toISOString();

  const existing = await getIdentidadFotoStatus(resolved).catch(() => null);

  const { error: upErr } = await supabaseAdmin.storage.from(BUCKET).upload(storagePath, buffer, {
    contentType: mime.startsWith('image/') ? mime : 'image/jpeg',
    cacheControl: '3600',
    upsert: true
  });
  if (upErr) {
    return Response.json({ ok: false, error: `Error subiendo foto: ${upErr.message}` }, { status: 500 });
  }

  const payload = {
    identidad_foto_path: storagePath,
    identidad_foto_at: nowIso,
    identidad_foto_hash: hash,
    updated_at: nowIso
  };

  if (envioId) {
    const { error: updErr } = await supabaseAdmin.from('firma_envios').update(payload).eq('id', envioId);
    if (updErr) {
      return Response.json(
        {
          ok: false,
          error: String(updErr.message || '').includes('identidad_foto')
            ? 'Falta migrar identidad foto en Supabase. Ejecuta database/alter_firma_identidad_foto.sql'
            : updErr.message
        },
        { status: 500 }
      );
    }
  } else {
    const { error: updErr } = await supabaseAdmin
      .from('firma_documentos')
      .update({
        identidad_foto_path: storagePath,
        identidad_foto_at: nowIso,
        identidad_foto_hash: hash
      })
      .eq('id', documentoId);
    if (updErr) {
      return Response.json(
        {
          ok: false,
          error: String(updErr.message || '').includes('identidad_foto')
            ? 'Falta migrar identidad foto en Supabase. Ejecuta database/alter_firma_identidad_foto.sql'
            : updErr.message
        },
        { status: 500 }
      );
    }
  }

  if (existing?.path && existing.path !== storagePath) {
    await supabaseAdmin.storage.from(BUCKET).remove([existing.path]).catch(() => {});
  }

  const { ip, userAgent } = await getRequestInfo();
  await supabaseAdmin.from('firma_auditorias').insert({
    documento_id: documentoId,
    ip,
    user_agent: userAgent,
    resultado: 'ok',
    detalle: {
      accion: 'identidad_foto_subida',
      envio_id: envioId,
      path: storagePath,
      hash,
      finalidad: 'verificacion_identidad_firma',
      acepta_uso_verificacion: true,
      informacion_mostrada:
        'Imagen para verificación de identidad; se guarda en BBDD/almacenamiento como evidencia del expediente de firma'
    }
  });

  return Response.json({ ok: true, at: nowIso, hash });
}
