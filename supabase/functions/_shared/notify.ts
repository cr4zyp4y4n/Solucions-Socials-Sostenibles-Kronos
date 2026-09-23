// Notificacions desacoblades (Telegram / log / none).
// Secrets (Edge):
//   OBRADOR_NOTIFY_CHANNEL = log | telegram | none   (default: log)
//   OBRADOR_NOTIFY_RECIPIENTS = chat_ids Telegram separats per coma (pendent decidir qui)
//   TELEGRAM_BOT_TOKEN = token del bot (només si channel=telegram)

export type NotifyPayload = {
  title: string;
  body: string;
  meta?: Record<string, unknown>;
};

export type NotifyResult = {
  ok: boolean;
  channel: string;
  detail?: string;
};

function parseRecipients(): string[] {
  return String(Deno.env.get('OBRADOR_NOTIFY_RECIPIENTS') || '')
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

async function notifyTelegram(payload: NotifyPayload): Promise<NotifyResult> {
  const token = Deno.env.get('TELEGRAM_BOT_TOKEN') || '';
  const recipients = parseRecipients();
  if (!token) {
    return { ok: false, channel: 'telegram', detail: 'Falta TELEGRAM_BOT_TOKEN' };
  }
  if (!recipients.length) {
    console.warn('[notify] telegram sense OBRADOR_NOTIFY_RECIPIENTS — només log');
    console.log('[notify:telegram:pending]', payload.title, payload.body, payload.meta);
    return { ok: true, channel: 'telegram', detail: 'sense destinataris; logged' };
  }

  const text = `*${escapeMd(payload.title)}*\n${escapeMd(payload.body)}`;
  const errors: string[] = [];

  for (const chatId of recipients) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: 'Markdown',
          disable_web_page_preview: true,
        }),
      });
      if (!res.ok) {
        const t = await res.text();
        errors.push(`${chatId}: ${res.status} ${t.slice(0, 120)}`);
      }
    } catch (e) {
      errors.push(`${chatId}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  if (errors.length) {
    return { ok: false, channel: 'telegram', detail: errors.join('; ') };
  }
  return { ok: true, channel: 'telegram' };
}

function escapeMd(s: string): string {
  return String(s || '').replace(/([_*`\[\]])/g, '\\$1');
}

/** Canal configurable. No assumeix destinataris ni Telegram fins que es configuri. */
export async function notify(payload: NotifyPayload): Promise<NotifyResult> {
  const channel = (Deno.env.get('OBRADOR_NOTIFY_CHANNEL') || 'log').toLowerCase().trim();

  if (channel === 'none') {
    return { ok: true, channel: 'none' };
  }

  if (channel === 'telegram') {
    return notifyTelegram(payload);
  }

  // default: log (visible a Edge Function logs)
  console.log('[notify:log]', payload.title, '|', payload.body, payload.meta || {});
  return { ok: true, channel: 'log' };
}
