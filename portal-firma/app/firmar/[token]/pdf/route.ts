import { resolveFirmaToken } from '@/lib/resolveFirmaToken';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const url = new URL(req.url);
  const docId = String(url.searchParams.get('doc') || '').trim();

  const resolved = await resolveFirmaToken(token);
  if (!resolved) {
    return new Response('Token no válido', { status: 404 });
  }
  if (resolved.isExpired || resolved.isRevoked) {
    return new Response('Token caducado o revocado', { status: 410 });
  }

  const documento = docId
    ? resolved.documentos.find((d) => d.id === docId)
    : resolved.documentos[0];

  const storagePath = documento?.storage_path_firmado || documento?.storage_path;
  if (!documento || !storagePath) {
    return new Response('Documento sin PDF', { status: 404 });
  }

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
