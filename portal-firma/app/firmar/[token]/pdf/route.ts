import { supabaseAdmin } from '@/lib/supabase';

export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;

  const { data: tokenRow, error } = await supabaseAdmin
    .from('firma_tokens')
    .select(
      `
      id,
      token,
      expires_at,
      used_at,
      revoked_at,
      documento:firma_documentos!firma_tokens_documento_id_fkey (
        id,
        storage_path,
        file_name
      )
    `
    )
    .eq('token', token)
    .maybeSingle();

  if (error) {
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
  if (!tokenRow) {
    return new Response('Token no válido', { status: 404 });
  }

  const expiresAt = new Date(tokenRow.expires_at);
  const isExpired = Number.isFinite(expiresAt.getTime()) && expiresAt.getTime() < Date.now();
  const isRevoked = !!tokenRow.revoked_at;

  if (isExpired || isRevoked) {
    return new Response('Token caducado o revocado', { status: 410 });
  }

  const documento = Array.isArray(tokenRow.documento) ? tokenRow.documento[0] : tokenRow.documento;
  const storagePath = documento?.storage_path;
  if (!storagePath) {
    return new Response('Documento sin PDF', { status: 404 });
  }

  // Signed URL corta y fetch server-side para servirlo same-origin (evita CSP de iframes)
  const { data: signedData, error: signedErr } = await supabaseAdmin.storage
    .from('firma-documentos')
    .createSignedUrl(storagePath, 60 * 5);
  if (signedErr) {
    return new Response(`Error firmando URL: ${signedErr.message}`, { status: 500 });
  }
  const signedUrl = signedData?.signedUrl;
  if (!signedUrl) {
    return new Response('No se pudo firmar la URL del PDF', { status: 500 });
  }

  const res = await fetch(signedUrl);
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    return new Response(`Error descargando PDF (${res.status}): ${txt}`, { status: 502 });
  }

  const buf = await res.arrayBuffer();
  const fileName = documento.file_name || 'documento.pdf';
  return new Response(buf, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${encodeURIComponent(fileName)}"`,
      'Cache-Control': 'no-store'
    }
  });
}

