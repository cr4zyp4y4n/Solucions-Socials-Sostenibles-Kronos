type SendSmsArgs = {
  to: string;
  body: string;
};

function normalizePhone(phone: string) {
  // Asumimos números españoles; si ya viene con +, lo respetamos
  const raw = String(phone || '').trim().replace(/\s+/g, '');
  if (!raw) return '';
  if (raw.startsWith('+')) return raw;
  if (raw.startsWith('00')) return `+${raw.slice(2)}`;
  if (/^\d{9}$/.test(raw)) return `+34${raw}`;
  return raw;
}

export async function sendSms({ to, body }: SendSmsArgs) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID || '';
  const authToken = process.env.TWILIO_AUTH_TOKEN || '';
  const from = process.env.TWILIO_FROM || '';

  const toNorm = normalizePhone(to);
  if (!toNorm) throw new Error('Teléfono destino inválido');

  // Modo dev: si no hay Twilio configurado, no enviamos (y lo tratamos como "debug")
  if (!accountSid || !authToken || !from) {
    return { delivery: 'debug' as const, to: toNorm };
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const form = new URLSearchParams();
  form.set('To', toNorm);
  form.set('From', from);
  form.set('Body', body);

  const basic = Buffer.from(`${accountSid}:${authToken}`, 'utf8').toString('base64');
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: form.toString()
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Twilio error (${res.status}): ${txt}`);
  }

  return { delivery: 'sms' as const, to: toNorm };
}

