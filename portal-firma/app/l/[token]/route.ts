export const runtime = 'nodejs';

export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const dest = new URL(`/firmar/${encodeURIComponent(token)}`, req.url);
  return Response.redirect(dest, 307);
}

