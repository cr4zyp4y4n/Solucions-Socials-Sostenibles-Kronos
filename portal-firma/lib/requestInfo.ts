import { headers } from 'next/headers';

export async function getRequestInfo() {
  const h = await headers();
  const userAgent = h.get('user-agent') || '';

  // En dev suele venir vacío; en producción detrás de proxy usaremos x-forwarded-for
  const xff = h.get('x-forwarded-for') || '';
  const ip = (xff.split(',')[0] || '').trim() || h.get('x-real-ip') || '';

  return { ip, userAgent };
}

