import path from 'node:path';
import { fileURLToPath } from 'node:url';

const configDir = path.dirname(fileURLToPath(import.meta.url));
const isProd = process.env.NODE_ENV === 'production';
const configuredUsahaOrigin = (
  process.env.NEXT_PUBLIC_USAHA_URL || ''
).replace(/\/$/, '');
const usahaOrigin = configuredUsahaOrigin.startsWith('https://')
  ? configuredUsahaOrigin
  : 'https://usaha.lajukan.com';

const contentSecurityPolicy = [
  "default-src 'self'",
  "frame-ancestors 'none'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  process.env.NODE_ENV === 'production'
    ? "script-src 'self' 'unsafe-inline'"
    : "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "connect-src 'self' https: http: ws: wss:",
].join('; ');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  experimental: {
    externalDir: true,
  },
  turbopack: {
    root: path.resolve(configDir),
  },
  async headers() {
    const securityHeaders = [
      {
        key: 'Content-Security-Policy',
        value: contentSecurityPolicy,
      },
      {
        key: 'Referrer-Policy',
        value: 'strict-origin-when-cross-origin',
      },
      {
        key: 'X-Content-Type-Options',
        value: 'nosniff',
      },
      {
        key: 'X-Frame-Options',
        value: 'DENY',
      },
      {
        key: 'Permissions-Policy',
        value: 'camera=(), microphone=(), geolocation=(self)',
      },
    ];

    if (isProd) {
      securityHeaders.push({
        key: 'Strict-Transport-Security',
        value: 'max-age=31536000; includeSubDomains; preload',
      });
    }

    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
  async redirects() {
    if (!isProd) return [];

    return [
      {
        source: '/:path*',
        has: [{ type: 'header', key: 'x-forwarded-proto', value: 'http' }],
        destination: `${usahaOrigin}/:path*`,
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
