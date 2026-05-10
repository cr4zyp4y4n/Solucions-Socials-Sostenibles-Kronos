import crypto from 'node:crypto';

type OtpVerificationPayload = {
  documentoId: string;
  tokenId: string;
  challengeId: string;
  exp: number;
};

const VERSION = 'v1';
const DEFAULT_TTL_SECONDS = 30 * 60;

function getSigningSecret() {
  const secret =
    process.env.FIRMA_OTP_VERIFICATION_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.FIRMA_SMS_API_SECRET ||
    '';

  if (!secret.trim()) {
    throw new Error('Falta FIRMA_OTP_VERIFICATION_SECRET o SUPABASE_SERVICE_ROLE_KEY para firmar verificaciones OTP');
  }

  return secret;
}

function base64Url(input: Buffer | string) {
  return Buffer.from(input).toString('base64url');
}

function sign(unsignedToken: string) {
  return crypto
    .createHmac('sha256', getSigningSecret())
    .update(unsignedToken, 'utf8')
    .digest('base64url');
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export function createOtpVerificationToken(args: {
  documentoId: string;
  tokenId: string;
  challengeId: string;
  ttlSeconds?: number;
}) {
  const payload: OtpVerificationPayload = {
    documentoId: args.documentoId,
    tokenId: args.tokenId,
    challengeId: args.challengeId,
    exp: Math.floor(Date.now() / 1000) + (args.ttlSeconds || DEFAULT_TTL_SECONDS)
  };
  const encodedPayload = base64Url(JSON.stringify(payload));
  const unsignedToken = `${VERSION}.${encodedPayload}`;
  return `${unsignedToken}.${sign(unsignedToken)}`;
}

export function verifyOtpVerificationToken(
  verificationToken: string,
  expected: { documentoId: string; tokenId: string }
) {
  const [version, encodedPayload, signature, extra] = String(verificationToken || '').split('.');
  if (version !== VERSION || !encodedPayload || !signature || extra !== undefined) return false;

  const unsignedToken = `${version}.${encodedPayload}`;
  if (!safeEqual(signature, sign(unsignedToken))) return false;

  let payload: OtpVerificationPayload;
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
  } catch {
    return false;
  }

  if (!payload?.documentoId || !payload?.tokenId || !payload?.challengeId || !payload?.exp) return false;
  if (payload.documentoId !== expected.documentoId || payload.tokenId !== expected.tokenId) return false;
  if (payload.exp < Math.floor(Date.now() / 1000)) return false;

  return true;
}
