import crypto from 'node:crypto';

const COOKIE_NAME = 'firma_otp_session';
const SESSION_TTL_SECONDS = 15 * 60;

type OtpSessionPayload = {
  tokenId: string;
  documentoId: string;
  challengeId: string;
  exp: number;
};

function getSigningSecret() {
  const secret =
    process.env.FIRMA_OTP_SESSION_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.FIRMA_SMS_API_SECRET ||
    '';
  if (!secret.trim()) {
    throw new Error('Falta secreto servidor para firmar la sesión OTP');
  }
  return secret;
}

function base64UrlEncode(value: string) {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function sign(payload: string) {
  return crypto.createHmac('sha256', getSigningSecret()).update(payload).digest('base64url');
}

function safeEqual(a: string, b: string) {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  return aBuf.length === bBuf.length && crypto.timingSafeEqual(aBuf, bBuf);
}

export function createOtpSessionCookie(input: Omit<OtpSessionPayload, 'exp'>) {
  const payload: OtpSessionPayload = {
    ...input,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS
  };
  const encoded = base64UrlEncode(JSON.stringify(payload));
  const signature = sign(encoded);
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${COOKIE_NAME}=${encoded}.${signature}; Path=/firmar; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}${secure}`;
}

export function readOtpSession(cookieHeader: string | null): OtpSessionPayload | null {
  const cookie = String(cookieHeader || '')
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE_NAME}=`));
  if (!cookie) return null;

  const raw = cookie.slice(COOKIE_NAME.length + 1);
  const [encoded, signature] = raw.split('.');
  if (!encoded || !signature || !safeEqual(sign(encoded), signature)) return null;

  try {
    const payload = JSON.parse(base64UrlDecode(encoded)) as OtpSessionPayload;
    if (!payload.tokenId || !payload.documentoId || !payload.challengeId || !payload.exp) return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

