export const runtime = 'nodejs';

import { sendSms } from '@/lib/sms';

function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

export async function POST(req: Request) {
  const secret = process.env.FIRMA_SMS_API_SECRET || '';
  if (!secret) {
    return json({ ok: false, error: 'FIRMA_SMS_API_SECRET no configurado en el servidor' }, 500);
  }

  const auth = req.headers.get('authorization') || '';
  const expected = `Bearer ${secret}`;
  if (auth !== expected) {
    return json({ ok: false, error: 'No autorizado' }, 401);
  }

  const body = await req.json().catch(() => ({}));
  const to = String(body?.to || '').trim();
  const bodyText = String(body?.body || '').trim();

  if (!to || !bodyText) {
    return json({ ok: false, error: 'Faltan campos to o body' }, 400);
  }

  try {
    const result = await sendSms({ to, body: bodyText });
    return json({ ok: true, ...result });
  } catch (e: any) {
    return json({ ok: false, error: e?.message || 'Error enviando SMS' }, 502);
  }
}
