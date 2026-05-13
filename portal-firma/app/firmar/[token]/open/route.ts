import { marcarPortalAbiertoSiCorresponde } from '@/lib/firmaPortalTracking';

export async function POST(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const result = await marcarPortalAbiertoSiCorresponde(token);
  if (!result.ok) {
    return Response.json({ ok: false, error: result.error }, { status: 500 });
  }
  return Response.json({ ok: true, skipped: result.skipped });
}
