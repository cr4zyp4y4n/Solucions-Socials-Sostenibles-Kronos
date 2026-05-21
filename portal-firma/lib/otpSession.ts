import crypto from 'node:crypto';

const COOKIE_NAME = 'firma_otp_verified';
const MAX_AGE_SECONDS = 30 * 60;

type OtpSessionPayload = {
  tokenId: string;
  documentoId: string;
  challengeId: string;
  exp: number;
};

type ExpectedOtpSession = {
  tokenId: string;
  documentoId: string;
  challengeId: string;
};

function getSigningSecret() {
  const secret = process.env.FIRMA_OTP_SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.FIRMA_SMS_API_SECRET;
  if (secret?.trim()) return secret.trim();
  if (process.env.NODE_ENV !== 'production') {
    return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'firma-otp-dev-secret';
  }
  throw new Error('Falta FIRMA_OTP_SESSION_SECRET para validar la sesión OTP');
}

function base64UrlEncode(value: string) {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function signPayload(payload: string) {
  return crypto.createHmac('sha256', getSigningSecret()).update(payload).digest('base64url');
}

function safeEqual(a: string, b: string) {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  return aBuf.length === bBuf.length && crypto.timingSafeEqual(aBuf, bBuf);
}

function getCookie(cookieHeader: string | null, name: string) {
  if (!cookieHeader) return '';
  for (const chunk of cookieHeader.split(';')) {
    const [rawName, ...rawValue] = chunk.trim().split('=');
    if (rawName === name) return rawValue.join('=');
  }
  return '';
}

export function buildOtpSessionCookie(payload: ExpectedOtpSession, token: string) {
  const sessionPayload: OtpSessionPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(sessionPayload));
  const signature = signPayload(encodedPayload);
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  const path = `/firmar/${encodeURIComponent(token)}`;

  return `${COOKIE_NAME}=${encodedPayload}.${signature}; Path=${path}; Max-Age=${MAX_AGE_SECONDS}; HttpOnly; SameSite=Lax${secure}`;
}

export function hasValidOtpSession(cookieHeader: string | null, expected: ExpectedOtpSession) {
  const cookie = getCookie(cookieHeader, COOKIE_NAME);
  const [encodedPayload, signature] = cookie.split('.');
  if (!encodedPayload || !signature) return false;

  const expectedSignature = signPayload(encodedPayload);
  if (!safeEqual(signature, expectedSignature)) return false;

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as Partial<OtpSessionPayload>;
    const nowSeconds = Math.floor(Date.now() / 1000);
    return (
      payload.tokenId === expected.tokenId &&
      payload.documentoId === expected.documentoId &&
      payload.challengeId === expected.challengeId &&
      typeof payload.exp === 'number' &&
      payload.exp >= nowSeconds
    );
  } catch {
    return false;
  }
}
