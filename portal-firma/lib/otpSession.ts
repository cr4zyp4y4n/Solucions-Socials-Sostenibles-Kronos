import crypto from 'node:crypto';

export const OTP_SESSION_COOKIE = 'firma_otp_session';
const OTP_SESSION_TTL_SECONDS = 30 * 60;

type OtpSessionPayload = {
  token: string;
  documentoId: string;
  challengeId: string;
  exp: number;
};

function getSigningSecret() {
  const secret = process.env.FIRMA_OTP_SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!secret) {
    throw new Error('Falta secreto para firmar la sesión OTP');
  }

  return secret;
}

function sign(value: string) {
  return crypto.createHmac('sha256', getSigningSecret()).update(value, 'utf8').digest('base64url');
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function encodePayload(payload: OtpSessionPayload) {
  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  return `${encodedPayload}.${sign(encodedPayload)}`;
}

function decodePayload(value: string): OtpSessionPayload | null {
  const [encodedPayload, signature] = value.split('.');
  if (!encodedPayload || !signature || !safeEqual(sign(encodedPayload), signature)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
    if (
      typeof payload?.token !== 'string' ||
      typeof payload?.documentoId !== 'string' ||
      typeof payload?.challengeId !== 'string' ||
      typeof payload?.exp !== 'number'
    ) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

function cookiePath(token: string) {
  return `/firmar/${encodeURIComponent(token)}`;
}

export function createOtpSessionCookie({
  token,
  documentoId,
  challengeId
}: {
  token: string;
  documentoId: string;
  challengeId: string;
}) {
  const payload = {
    token,
    documentoId,
    challengeId,
    exp: Math.floor(Date.now() / 1000) + OTP_SESSION_TTL_SECONDS
  };
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${OTP_SESSION_COOKIE}=${encodePayload(payload)}; HttpOnly; SameSite=Strict; Path=${cookiePath(token)}; Max-Age=${OTP_SESSION_TTL_SECONDS}${secure}`;
}

export function createClearedOtpSessionCookie(token: string) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${OTP_SESSION_COOKIE}=; HttpOnly; SameSite=Strict; Path=${cookiePath(token)}; Max-Age=0${secure}`;
}

export function readOtpSession(
  cookieHeader: string | null,
  expected: { token: string; documentoId: string }
) {
  const cookie = (cookieHeader || '')
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${OTP_SESSION_COOKIE}=`));

  if (!cookie) return null;

  const payload = decodePayload(cookie.slice(OTP_SESSION_COOKIE.length + 1));
  if (!payload) return null;
  if (payload.token !== expected.token || payload.documentoId !== expected.documentoId) return null;
  if (payload.exp < Math.floor(Date.now() / 1000)) return null;

  return payload;
}
