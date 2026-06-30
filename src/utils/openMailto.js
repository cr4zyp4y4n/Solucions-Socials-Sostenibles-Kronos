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

export function formatEmailDebugLine(debug) {
  if (!debug || typeof debug !== 'object') return '';
  const parts = [
    `modo=${debug.mode || '?'}`,
    `via=${debug.via || '?'}`,
    `opener=${debug.opener || '?'}`,
    `progId=${debug.progId || '?'}`,
    debug.handlerIsBrowser ? 'handler=navegador' : 'handler=cliente-correo'
  ];
  if (debug.error) parts.push(`error=${debug.error}`);
  return parts.join(' · ');
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
 * @returns {Promise<{ via: 'ipc' | 'gmail-compose' | 'ionos-compose' | 'outlook-compose' | 'custom-compose' | 'mailto-ipc' | 'clipboard', debug?: object }>}
 */
export async function openEmailDraft({ to, subject = '', body = '' }) {
  const email = String(to || '').trim();
  if (!email) throw new Error('Falta email');

  const draft = { to: email, subject, body };

  if (typeof window !== 'undefined' && window.electronAPI?.openEmailDraft) {
    try {
      const result = await window.electronAPI.openEmailDraft(draft);
      const debug = result?.debug || null;
      if (debug) {
        console.log('[firma-email] renderer ← main', debug);
      }
      const via = result?.via || 'ipc';
      if (via === 'gmail-compose' || via === 'ionos-compose' || via === 'outlook-compose' || via === 'custom-compose') {
        return { via, debug };
      }
      return { via: 'ipc', debug };
    } catch (e) {
      const msg = String(e?.message || e || '');
      console.warn('[firma-email] openEmailDraft IPC falló:', msg);
      if (msg.includes('No handler registered')) {
        console.warn('[firma-email] Reinicia Kronos por completo (cambios en main/preload).');
      }
    }
  } else {
    console.warn('[firma-email] electronAPI.openEmailDraft no disponible — ¿app sin reiniciar?');
  }

  if (typeof window !== 'undefined' && window.electronAPI?.openMailto) {
    try {
      const url = buildMailtoUrl(draft);
      console.log('[firma-email] fallback openMailto:', url.slice(0, 200));
      await window.electronAPI.openMailto(url);
      return { via: 'mailto-ipc' };
    } catch (e) {
      console.warn('[firma-email] openMailto IPC:', e?.message || e);
    }
  }

  console.warn('[firma-email] Copiando borrador al portapapeles (último recurso)');
  await copyTextToClipboard(formatEmailDraftForClipboard(draft));
  return { via: 'clipboard' };
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
