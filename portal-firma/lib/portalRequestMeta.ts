import { headers } from 'next/headers';

export type PortalVisitaSource = 'ssr_get' | 'client_post_open';

export type PortalRequestMeta = {
  source: PortalVisitaSource;
  ip: string;
  userAgent: string;
  referer: string;
  accept: string;
  secFetchSite: string;
  secFetchMode: string;
  secFetchDest: string;
  host: string;
};

export type ClienteTipo =
  | 'whatsapp'
  | 'telegram'
  | 'link_preview'
  | 'bot'
  | 'headless'
  | 'electron_kronos'
  | 'curl_script'
  | 'navegador';

function pickIp(h: Headers): string {
  const xff = h.get('x-forwarded-for') || '';
  return (xff.split(',')[0] || '').trim() || h.get('x-real-ip') || '';
}

function metaFromHeaders(h: Headers, source: PortalVisitaSource): PortalRequestMeta {
  return {
    source,
    ip: pickIp(h),
    userAgent: h.get('user-agent') || '',
    referer: h.get('referer') || '',
    accept: h.get('accept') || '',
    secFetchSite: h.get('sec-fetch-site') || '',
    secFetchMode: h.get('sec-fetch-mode') || '',
    secFetchDest: h.get('sec-fetch-dest') || '',
    host: h.get('host') || ''
  };
}

export async function getPortalRequestMeta(source: PortalVisitaSource): Promise<PortalRequestMeta> {
  const h = await headers();
  return metaFromHeaders(h, source);
}

export function getPortalRequestMetaFromRequest(
  req: Request,
  source: PortalVisitaSource
): PortalRequestMeta {
  return metaFromHeaders(req.headers, source);
}

/** Heurística para identificar previews de WhatsApp, bots, etc. */
export function classifyPortalCliente(meta: Pick<PortalRequestMeta, 'userAgent' | 'referer' | 'accept'>): ClienteTipo {
  const ua = String(meta.userAgent || '').toLowerCase();
  const ref = String(meta.referer || '').toLowerCase();
  const accept = String(meta.accept || '').toLowerCase();

  if (ua.includes('whatsapp')) return 'whatsapp';
  if (ua.includes('telegram')) return 'telegram';
  if (
    ua.includes('facebookexternalhit') ||
    ua.includes('facebot') ||
    ua.includes('twitterbot') ||
    ua.includes('linkedinbot') ||
    ua.includes('slackbot') ||
    ua.includes('discordbot') ||
    ua.includes('preview') ||
    ua.includes('linkpreview') ||
    ref.includes('api.whatsapp.com')
  ) {
    return 'link_preview';
  }
  if (
    ua.includes('googlebot') ||
    ua.includes('bingbot') ||
    ua.includes('duckduckbot') ||
    ua.includes('baiduspider') ||
    ua.includes('yandexbot') ||
    ua.includes('petalbot')
  ) {
    return 'bot';
  }
  if (
    ua.includes('headlesschrome') ||
    ua.includes('phantomjs') ||
    ua.includes('puppeteer') ||
    ua.includes('playwright')
  ) {
    return 'headless';
  }
  if (ua.includes('electron') || ua.includes('sss-kronos')) return 'electron_kronos';
  if (
    ua.includes('curl') ||
    ua.includes('wget') ||
    ua.includes('python-requests') ||
    ua.includes('go-http-client') ||
    ua.includes('java/') ||
    accept === '*/*' && !ua.includes('mozilla')
  ) {
    return 'curl_script';
  }
  return 'navegador';
}

export function describeClienteTipo(tipo: ClienteTipo): string {
  switch (tipo) {
    case 'whatsapp':
      return 'WhatsApp (posible vista previa del enlace)';
    case 'telegram':
      return 'Telegram (posible vista previa)';
    case 'link_preview':
      return 'Bot de vista previa / red social';
    case 'bot':
      return 'Bot de buscador o rastreador';
    case 'headless':
      return 'Navegador automatizado (headless)';
    case 'electron_kronos':
      return 'Electron / posible Kronos';
    case 'curl_script':
      return 'Script o cliente HTTP (no navegador)';
    default:
      return 'Navegador web';
  }
}
