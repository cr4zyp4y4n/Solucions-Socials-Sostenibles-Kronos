import { registrarOnboardingPortal, type FirmaOnboardingEvento } from '@/lib/firmaOnboardingAudit';
import { resolveFirmaToken } from '@/lib/resolveFirmaToken';

const ALLOWED: FirmaOnboardingEvento[] = [
  'modal_mostrado',
  'eleccion_primera_vez',
  'rechazado_inicio',
  'guia_abandonada',
  'paso_siguiente',
  'completado'
];

export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const evento = String(body?.evento || '').trim() as FirmaOnboardingEvento;

  if (!ALLOWED.includes(evento)) {
    return Response.json({ ok: false, error: 'Evento no válido' }, { status: 400 });
  }

  const resolved = await resolveFirmaToken(token);
  if (!resolved) return Response.json({ ok: false, error: 'Token no válido' }, { status: 404 });
  if (resolved.isExpired || resolved.isRevoked || resolved.isUsed) {
    return Response.json({ ok: false, error: 'Token caducado, revocado o usado' }, { status: 410 });
  }

  const paso = Number.isFinite(Number(body?.paso)) ? Number(body.paso) : undefined;
  const totalPasos = Number.isFinite(Number(body?.totalPasos)) ? Number(body.totalPasos) : undefined;
  const isPack = body?.isPack === true;

  const result = await registrarOnboardingPortal(token, {
    evento,
    paso,
    totalPasos,
    isPack
  });

  if (!result.ok) {
    return Response.json({ ok: false, error: result.error }, { status: 500 });
  }

  return Response.json({ ok: true, accion: result.accion });
}
