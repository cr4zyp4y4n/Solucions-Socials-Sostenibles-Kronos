import { createHmac, timingSafeEqual } from 'crypto';

export const OTP_SESSION_COOKIE = 'firma_otp_session';
const OTP_SESSION_MAX_AGE_SECONDS = 30 * 60;

export type OtpSession = {
  tokenId: string;
  documentoId: string;
  challengeId: string;
  expiresAt: number;
};

function getSigningSecret() {
  const secret =
    process.env.FIRMA_OTP_SESSION_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.FIRMA_SMS_API_SECRET ||
    '';

  if (secret) return secret;
  if (process.env.NODE_ENV !== 'production') return 'dev-only-firma-otp-session-secret';
  throw new Error('Falta FIRMA_OTP_SESSION_SECRET o SUPABASE_SERVICE_ROLE_KEY');
}

function base64Url(input: string | Buffer) {
  return Buffer.from(input).toString('base64url');
}

function signPayload(payload: string) {
  return createHmac('sha256', getSigningSecret()).update(payload).digest('base64url');
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function parseCookieHeader(cookieHeader: string | null) {
  const cookies = new Map<string, string>();
  for (const part of String(cookieHeader || '').split(';')) {
    const [rawName, ...rawValue] = part.trim().split('=');
    if (!rawName || !rawValue.length) continue;
    cookies.set(rawName, rawValue.join('='));
  }
  return cookies;
}

export function createOtpSessionCookie(
  session: Omit<OtpSession, 'expiresAt'>,
  token: string
) {
  const payload = base64Url(
    JSON.stringify({
      ...session,
      expiresAt: Date.now() + OTP_SESSION_MAX_AGE_SECONDS * 1000
    })
  );
  const signature = signPayload(payload);
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  const path = `/firmar/${encodeURIComponent(token)}`;

  return `${OTP_SESSION_COOKIE}=${payload}.${signature}; Path=${path}; HttpOnly; SameSite=Strict; Max-Age=${OTP_SESSION_MAX_AGE_SECONDS}${secure}`;
}

export function getOtpSessionFromRequest(req: Request): OtpSession | null {
  const raw = parseCookieHeader(req.headers.get('cookie')).get(OTP_SESSION_COOKIE);
  if (!raw) return null;

  const [payload, signature] = raw.split('.');
  if (!payload || !signature || !safeEqual(signPayload(payload), signature)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Partial<OtpSession>;
    if (
      typeof parsed.tokenId !== 'string' ||
      typeof parsed.documentoId !== 'string' ||
      typeof parsed.challengeId !== 'string' ||
      typeof parsed.expiresAt !== 'number' ||
      parsed.expiresAt < Date.now()
    ) {
      return null;
    }

    return {
      tokenId: parsed.tokenId,
      documentoId: parsed.documentoId,
      challengeId: parsed.challengeId,
      expiresAt: parsed.expiresAt
    };
  } catch {
    return null;
  }
}
