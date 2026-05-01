import crypto from 'node:crypto';

type ReceiptPayload = {
  tokenId: string;
  documentoId: string;
  challengeId: string;
  issuedAt: string;
  expiresAt: string;
};

const RECEIPT_TTL_MS = 30 * 60 * 1000;

function getReceiptSecret() {
  const secret = process.env.FIRMA_RECEIPT_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!secret) {
    throw new Error('Falta FIRMA_RECEIPT_SECRET o SUPABASE_SERVICE_ROLE_KEY para firmar verificaciones OTP');
  }
  return secret;
}

function signPayload(encodedPayload: string) {
  return crypto.createHmac('sha256', getReceiptSecret()).update(encodedPayload, 'utf8').digest('base64url');
}

export function createOtpReceipt({
  tokenId,
  documentoId,
  challengeId
}: {
  tokenId: string;
  documentoId: string;
  challengeId: string;
}) {
  const now = Date.now();
  const payload: ReceiptPayload = {
    tokenId,
    documentoId,
    challengeId,
    issuedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + RECEIPT_TTL_MS).toISOString()
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  return `${encodedPayload}.${signPayload(encodedPayload)}`;
}

export function verifyOtpReceipt(receipt: string): ReceiptPayload {
  const [encodedPayload, signature, extra] = String(receipt || '').split('.');
  if (!encodedPayload || !signature || extra !== undefined) {
    throw new Error('Recibo OTP inválido');
  }

  const expectedSignature = signPayload(encodedPayload);
  const received = Buffer.from(signature, 'base64url');
  const expected = Buffer.from(expectedSignature, 'base64url');
  if (received.length !== expected.length || !crypto.timingSafeEqual(received, expected)) {
    throw new Error('Recibo OTP inválido');
  }

  const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as ReceiptPayload;
  if (!payload.tokenId || !payload.documentoId || !payload.challengeId || !payload.expiresAt) {
    throw new Error('Recibo OTP incompleto');
  }

  const expiresAt = new Date(payload.expiresAt);
  if (!Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() < Date.now()) {
    throw new Error('Recibo OTP caducado');
  }

  return payload;
}
