/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    // CSP necesaria para poder embeber el PDF desde Supabase (bucket privado con signed URL)
    const csp = [
      "default-src 'self' data: blob:",
      "base-uri 'self'",
      "form-action 'self'",
      "img-src 'self' data: blob: https://*.supabase.co",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
      "frame-src 'self' https://*.supabase.co",
      "object-src 'self' https://*.supabase.co blob:"
    ].join('; ');

    return [
      {
        source: '/:path*',
        headers: [{ key: 'Content-Security-Policy', value: csp }]
      }
    ];
  }
};

module.exports = nextConfig;

