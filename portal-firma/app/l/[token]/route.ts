export const runtime = 'nodejs';

export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const dest = `/firmar/${encodeURIComponent(token)}`;
  return Response.redirect(dest, 307);
}

