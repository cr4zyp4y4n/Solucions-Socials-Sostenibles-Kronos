export function buildMailtoUrl({ to, subject = '', body = '' }) {
  const email = String(to || '').trim();
  if (!email) throw new Error('Falta email');
  const params = new URLSearchParams();
  const subj = String(subject || '').trim();
  const txt = String(body || '').trim();
  if (subj) params.set('subject', subj);
  if (txt) params.set('body', txt);
  const qs = params.toString();
  return qs ? `mailto:${email}?${qs}` : `mailto:${email}`;
}

export function formatEmailDraftForClipboard({ to, subject = '', body = '' }) {
  const lines = [
    `Para: ${String(to || '').trim()}`,
    `Asunto: ${String(subject || '').trim()}`,
    '',
    String(body || '').trim()
  ];
  return lines.join('\n').trim();
}

async function copyTextToClipboard(text) {
  const s = String(text ?? '');
  if (!s) throw new Error('Vacío');
  if (typeof window !== 'undefined' && window.electronAPI?.writeClipboardText) {
    await window.electronAPI.writeClipboardText(s);
    return;
  }
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(s);
    return;
  }
  throw new Error('No se pudo copiar al portapapeles');
}

/**
 * Abre el borrador en el cliente de correo del sistema (vía proceso principal de Electron).
 * Si no puede, copia el mensaje al portapapeles. Nunca usa window.open ni <a> click (abre Chrome).
 * @returns {'ipc' | 'mailto-ipc' | 'clipboard'}
 */
export async function openEmailDraft({ to, subject = '', body = '' }) {
  const email = String(to || '').trim();
  if (!email) throw new Error('Falta email');

  const draft = { to: email, subject, body };

  if (typeof window !== 'undefined' && window.electronAPI?.openEmailDraft) {
    try {
      await window.electronAPI.openEmailDraft(draft);
      return 'ipc';
    } catch (e) {
      const msg = String(e?.message || e || '');
      if (!msg.includes('MAILTO_TOO_LONG') && !msg.includes('No handler registered')) {
        console.warn('openEmailDraft IPC:', msg);
      }
    }
  }

  if (typeof window !== 'undefined' && window.electronAPI?.openMailto) {
    try {
      const url = buildMailtoUrl(draft);
      await window.electronAPI.openMailto(url);
      return 'mailto-ipc';
    } catch (e) {
      console.warn('openMailto IPC:', e?.message || e);
    }
  }

  await copyTextToClipboard(formatEmailDraftForClipboard(draft));
  return 'clipboard';
}

/** @deprecated Usa openEmailDraft. */
export async function openMailtoUrl(mailtoUrl) {
  const url = String(mailtoUrl || '').trim();
  if (!/^mailto:/i.test(url)) {
    throw new Error('URL mailto inválida');
  }
  if (typeof window !== 'undefined' && window.electronAPI?.openMailto) {
    await window.electronAPI.openMailto(url);
    return;
  }
  throw new Error('Reinicia Kronos para abrir el correo desde la app');
}
