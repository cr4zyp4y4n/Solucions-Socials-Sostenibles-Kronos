import { registrarVisitaPortal } from '@/lib/firmaPortalTracking';
import { getPortalRequestMetaFromRequest } from '@/lib/portalRequestMeta';

export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const meta = getPortalRequestMetaFromRequest(req, 'client_post_open');
  const result = await registrarVisitaPortal(token, { ...meta, marcaPrimeraVisita: true });
  if (!result.ok) {
    return Response.json({ ok: false, error: result.error }, { status: 500 });
  }
  return Response.json({
    ok: true,
    skipped: result.skipped,
    marcoPrimeraVisita: result.marcoPrimeraVisita,
    skipReason: result.skipReason || null,
    clienteTipo: result.clienteTipo || null
  });
}
