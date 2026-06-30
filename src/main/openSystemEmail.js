const { execFileSync, spawn } = require('node:child_process');
const { shell } = require('electron');

const LOG_PREFIX = '[firma-email]';

function emailDebugEnabled() {
  return String(process.env.FIRMA_EMAIL_DEBUG || '').trim() === '1';
}

function logEmail(level, ...args) {
  const fn = level === 'warn' ? console.warn : level === 'error' ? console.error : console.log;
  fn(LOG_PREFIX, ...args);
}

function buildMailtoUrl({ to, subject = '', body = '' }) {
  const email = String(to || '').trim();
  if (!email) throw new Error('Falta email');
  const params = [];
  const subj = String(subject || '').trim();
  const txt = String(body || '').trim();
  if (subj) params.push(`subject=${encodeURIComponent(subj)}`);
  if (txt) params.push(`body=${encodeURIComponent(txt)}`);
  const qs = params.length ? `?${params.join('&')}` : '';
  return `mailto:${email}${qs}`;
}

function buildGmailComposeUrl({ to, subject = '', body = '' }) {
  const email = String(to || '').trim();
  if (!email) throw new Error('Falta email');
  const parts = [
    'https://mail.google.com/mail/?view=cm&fs=1',
    `to=${encodeURIComponent(email)}`
  ];
  const subj = String(subject || '').trim();
  const txt = String(body || '').trim();
  if (subj) parts.push(`su=${encodeURIComponent(subj)}`);
  if (txt) parts.push(`body=${encodeURIComponent(txt)}`);
  return parts.join('&');
}

function buildOutlookComposeUrl({ to, subject = '', body = '' }) {
  const email = String(to || '').trim();
  if (!email) throw new Error('Falta email');
  const params = new URLSearchParams();
  params.set('to', email);
  const subj = String(subject || '').trim();
  const txt = String(body || '').trim();
  if (subj) params.set('subject', subj);
  if (txt) params.set('body', txt);
  return `https://outlook.office.com/mail/deeplink/compose?${params.toString()}`;
}

/**
 * IONOS (OX App Suite) no documenta URL ?to=&su= como Gmail.
 * Patrón usado por webmails en Chrome: pasar el mailto completo (to+subject+body).
 * Si no rellena el borrador, usar FIRMA_EMAIL_MODE=mailto y registrar IONOS como
 * manejador mailto: en el navegador (mail.ionos.com → icono en la barra de direcciones).
 */
function buildIonosComposeUrl(draft) {
  const origin = String(process.env.FIRMA_EMAIL_IONOS_ORIGIN || 'https://mail.ionos.com').trim().replace(/\/$/, '');
  const mailto = buildMailtoUrl(draft);
  return `${origin}/?extsrc=mailto&url=${encodeURIComponent(mailto)}`;
}

function applyComposeUrlTemplate(template, draft) {
  const to = String(draft?.to || '').trim();
  const subject = String(draft?.subject || '').trim();
  const body = String(draft?.body || '').trim();
  const mailto = buildMailtoUrl({ to, subject, body });
  return String(template || '')
    .replace(/\{to\}/g, encodeURIComponent(to))
    .replace(/\{subject\}/g, encodeURIComponent(subject))
    .replace(/\{body\}/g, encodeURIComponent(body))
    .replace(/\{mailto\}/g, encodeURIComponent(mailto));
}

function resolveEmailMode() {
  const raw = String(process.env.FIRMA_EMAIL_MODE || 'auto').trim().toLowerCase();
  if (raw === 'gmail' || raw === 'gmail-compose') return 'gmail';
  if (raw === 'ionos' || raw === 'ionos-webmail') return 'ionos';
  if (raw === 'outlook' || raw === 'outlook-web') return 'outlook';
  if (raw === 'mailto') return 'mailto';
  if (raw === 'custom' || raw === 'template') return 'custom';
  return 'auto';
}

function resolveWebmailCompose(draft) {
  const customTemplate = String(process.env.FIRMA_EMAIL_COMPOSE_URL || '').trim();
  if (customTemplate) {
    return {
      via: 'custom-compose',
      url: applyComposeUrlTemplate(customTemplate, draft)
    };
  }

  const mode = resolveEmailMode();

  if (mode === 'gmail') {
    return { via: 'gmail-compose', url: buildGmailComposeUrl(draft) };
  }
  if (mode === 'ionos') {
    return { via: 'ionos-compose', url: buildIonosComposeUrl(draft) };
  }
  if (mode === 'outlook') {
    return { via: 'outlook-compose', url: buildOutlookComposeUrl(draft) };
  }
  if (mode === 'mailto') {
    return { via: 'mailto', url: buildMailtoUrl(draft) };
  }

  // auto: Gmail si el manejador mailto del sistema es un navegador (evita pestaña en blanco)
  if (shouldUseGmailInAutoMode()) {
    return { via: 'gmail-compose', url: buildGmailComposeUrl(draft) };
  }

  return { via: 'mailto', url: buildMailtoUrl(draft) };
}

function getWindowsMailtoProgId() {
  if (process.platform !== 'win32') return '';
  try {
    const out = execFileSync(
      'reg',
      ['query', 'HKCU\\Software\\Microsoft\\Windows\\Shell\\Associations\\UrlAssociations\\mailto\\UserChoice', '/v', 'ProgId'],
      { encoding: 'utf8', timeout: 4000, windowsHide: true }
    );
    const match = out.match(/ProgId\s+REG_SZ\s+(.+)/i);
    return match?.[1]?.trim() || '';
  } catch (_) {
    return '';
  }
}

function getWindowsMailtoCommand() {
  if (process.platform !== 'win32') return '';
  const progId = getWindowsMailtoProgId();
  if (progId) {
    const roots = ['HKCU\\Software\\Classes', 'HKCR'];
    for (const root of roots) {
      try {
        const out = execFileSync('reg', ['query', `${root}\\${progId}\\shell\\open\\command`, '/ve'], {
          encoding: 'utf8',
          timeout: 4000,
          windowsHide: true
        });
        const match = out.match(/REG_(?:EXPAND_)?SZ\s+(.+)/i);
        if (match?.[1]) return match[1].trim();
      } catch (_) {
        // siguiente raíz
      }
    }
  }
  const keys = [
    'HKCU\\Software\\Classes\\mailto\\shell\\open\\command',
    'HKCR\\mailto\\shell\\open\\command'
  ];
  for (const key of keys) {
    try {
      const out = execFileSync('reg', ['query', key, '/ve'], {
        encoding: 'utf8',
        timeout: 4000,
        windowsHide: true
      });
      const match = out.match(/REG_(?:EXPAND_)?SZ\s+(.+)/i);
      if (match?.[1]) return match[1].trim();
    } catch (_) {
      // siguiente clave del registro
    }
  }
  return '';
}

function progIdIsBrowser(progId) {
  if (!progId) return false;
  return /^(ChromeHTML|ChromiumHTML|MSEdgeHTM|FirefoxURL|BraveHTML|OperaStable|VivaldiHTML)/i.test(progId);
}

function mailtoHandlerIsBrowser(cmd) {
  if (!cmd) return false;
  return /(chrome|firefox|msedge|microsoftedge|iexplore|opera|brave|vivaldi)/i.test(cmd);
}

function shouldUseGmailInAutoMode() {
  if (process.platform !== 'win32') return false;
  const progId = getWindowsMailtoProgId();
  if (progIdIsBrowser(progId)) return true;
  return mailtoHandlerIsBrowser(getWindowsMailtoCommand());
}

/** @deprecated Usar resolveWebmailCompose */
function shouldUseGmailCompose() {
  const mode = resolveEmailMode();
  if (mode === 'gmail') return true;
  if (mode === 'mailto' || mode === 'ionos' || mode === 'outlook' || mode === 'custom') return false;
  return shouldUseGmailInAutoMode();
}

function summarizeHandler(cmd) {
  const s = String(cmd || '').trim();
  if (!s) return '(sin handler mailto en registro)';
  if (s.length <= 120) return s;
  return `${s.slice(0, 117)}...`;
}

function getEmailDebugInfo() {
  const progId = getWindowsMailtoProgId();
  const mailtoCommand = getWindowsMailtoCommand();
  const mode = resolveEmailMode();
  const customUrl = String(process.env.FIRMA_EMAIL_COMPOSE_URL || '').trim();
  return {
    platform: process.platform,
    mode,
    customComposeUrl: customUrl ? `${customUrl.slice(0, 80)}…` : '',
    ionosOrigin: String(process.env.FIRMA_EMAIL_IONOS_ORIGIN || 'https://mail.ionos.com').trim(),
    progId: progId || '(vacío)',
    mailtoCommand: summarizeHandler(mailtoCommand),
    handlerIsBrowser: progIdIsBrowser(progId) || mailtoHandlerIsBrowser(mailtoCommand),
    autoWouldUseGmail: shouldUseGmailInAutoMode(),
    debugEnabled: emailDebugEnabled(),
    hasElectronAPI: true
  };
}

function spawnDetached(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      detached: true,
      stdio: 'ignore',
      windowsHide: true
    });
    child.once('error', reject);
    child.once('spawn', () => {
      child.unref();
      resolve();
    });
  });
}

async function openUrlOnWindowsMailto(url) {
  const target = String(url || '').trim();
  if (!target) throw new Error('URL vacía');
  const escaped = target.replace(/'/g, "''");
  logEmail('log', 'Abriendo mailto con PowerShell Start-Process:', target.slice(0, 200));
  await spawnDetached('powershell.exe', [
    '-NoProfile',
    '-WindowStyle',
    'Hidden',
    '-Command',
    `Start-Process '${escaped}'`
  ]);
  return 'powershell-Start-Process';
}

async function openExternalUrl(url) {
  const target = String(url || '').trim();
  if (!target) throw new Error('URL vacía');

  if (/^https?:\/\//i.test(target)) {
    logEmail('log', 'Abriendo https con shell.openExternal:', target.slice(0, 400));
    await shell.openExternal(target);
    return 'shell.openExternal';
  }

  if (process.platform === 'win32' && /^mailto:/i.test(target)) {
    try {
      return await openUrlOnWindowsMailto(target);
    } catch (e) {
      logEmail('warn', 'PowerShell mailto falló, probando shell.openExternal:', e?.message || e);
    }
  }

  logEmail('log', 'Abriendo con shell.openExternal:', target.slice(0, 400));
  await shell.openExternal(target);
  return 'shell.openExternal';
}

/**
 * @returns {Promise<{ via: string, debug: object }>}
 */
async function openEmailDraftInSystem(draft) {
  const to = String(draft?.to || '').trim();
  const subject = String(draft?.subject || '').trim();
  const body = String(draft?.body || '').trim();
  if (!to || !to.includes('@')) {
    throw new Error('Email inválido');
  }

  const payload = { to, subject, body };
  const baseDebug = getEmailDebugInfo();
  const { via, url } = resolveWebmailCompose(payload);

  logEmail('log', 'Solicitud borrador', {
    to,
    subject: subject.slice(0, 80),
    bodyLen: body.length,
    via,
    ...baseDebug
  });

  if (url.length > 12000) {
    throw new Error('MAILTO_TOO_LONG');
  }

  const opener = await openExternalUrl(url);
  const debug = {
    ...baseDebug,
    to,
    via,
    opener,
    urlPreview: url.slice(0, 400),
    urlLength: url.length,
    showInUi: emailDebugEnabled()
  };
  logEmail('log', 'Resultado', debug);
  return { via, debug };
}

async function openMailtoInSystem(url) {
  const trimmed = String(url || '').trim();
  if (!/^mailto:/i.test(trimmed)) {
    throw new Error('URL mailto inválida');
  }
  if (trimmed.length > 12000) {
    throw new Error('URL demasiado larga');
  }
  logEmail('log', 'openMailtoInSystem:', trimmed.slice(0, 200));
  await openExternalUrl(trimmed);
  return true;
}

module.exports = {
  buildMailtoUrl,
  buildGmailComposeUrl,
  buildIonosComposeUrl,
  buildOutlookComposeUrl,
  openEmailDraftInSystem,
  openMailtoInSystem,
  shouldUseGmailCompose,
  getEmailDebugInfo,
  resolveEmailMode
};
