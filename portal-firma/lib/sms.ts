type SendSmsArgs = {
  to: string;
  body: string;
};

type SendSmsResult =
  | { delivery: 'debug'; to: string; via: 'debug' }
  | { delivery: 'sms'; to: string; via: 'messagingService' | 'from' };

function normalizePhone(phone: string) {
  // Asumimos números españoles; si ya viene con +, lo respetamos
  const raw = String(phone || '').trim().replace(/\s+/g, '');
  if (!raw) return '';
  if (raw.startsWith('+')) return raw;
  if (raw.startsWith('00')) return `+${raw.slice(2)}`;
  if (/^\d{9}$/.test(raw)) return `+34${raw}`;
  return raw;
}

function envTrim(key: string): string {
  return String(process.env[key] ?? '').trim();
}

export async function sendSms({ to, body }: SendSmsArgs): Promise<SendSmsResult> {
  // .trim(): espacios o saltos al final de línea en .env rompen Basic Auth (401 20003).
  const accountSid = envTrim('TWILIO_ACCOUNT_SID');
  const authToken = envTrim('TWILIO_AUTH_TOKEN');
  const from = envTrim('TWILIO_FROM');
  const messagingServiceSid = envTrim('TWILIO_MESSAGING_SERVICE_SID');
  // Para cuentas con Twilio Region (p.ej. IE1), el host puede no ser api.twilio.com.
  // Ejemplos (según Twilio): https://api.dublin.ie1.twilio.com
  // Solo el host (sin /2010-04-01): esa ruta la añadimos nosotros abajo.
  let apiBase = (envTrim('TWILIO_API_BASE') || 'https://api.twilio.com').replace(/\/$/, '');
  apiBase = apiBase.replace(/\/2010-04-01$/i, '').replace(/\/$/, '');

  const toNorm = normalizePhone(to);
  if (!toNorm) throw new Error('Teléfono destino inválido');

  // Modo dev: si no hay Twilio configurado, no enviamos (y lo tratamos como "debug")
  // Requiere From o MessagingServiceSid.
  if (!accountSid || !authToken || (!from && !messagingServiceSid)) {
    return { delivery: 'debug' as const, to: toNorm, via: 'debug' };
  }

  const url = `${apiBase}/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const form = new URLSearchParams();
  form.set('To', toNorm);
  if (messagingServiceSid) {
    form.set('MessagingServiceSid', messagingServiceSid);
  } else {
    form.set('From', from);
  }
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

  return {
    delivery: 'sms' as const,
    to: toNorm,
    via: messagingServiceSid ? 'messagingService' : 'from'
  };
}

