import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildInternalWebCsp,
  buildSecurityHeaders,
} from '../../packages/config/nextSecurityHeaders.mjs';

const CONFIG_DIR = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND_ROOT = path.resolve(CONFIG_DIR, '../..');
const DEPLOYMENT_ENV = (
  process.env.APP_ENV ||
  process.env.ENV ||
  process.env.NEXT_PUBLIC_APP_ENV ||
  process.env.NODE_ENV ||
  'development'
).toLowerCase();
const REQUIRES_EXTERNAL_HTTPS = ['staging', 'production'].includes(
  DEPLOYMENT_ENV,
);

const configuredUsahaOrigin = (
  process.env.NEXT_PUBLIC_USAHA_URL || ''
).replace(/\/$/, '');
const usahaOrigin = configuredUsahaOrigin.startsWith('https://')
  ? configuredUsahaOrigin
  : 'https://usaha.lajukan.com';

const securityHeaders = buildSecurityHeaders({
  csp: buildInternalWebCsp({
    production: REQUIRES_EXTERNAL_HTTPS,
    connectSources: ['https:', 'wss:', 'ws:'],
  }),
  production: REQUIRES_EXTERNAL_HTTPS,
  permissionsPolicy:
    'camera=(self), microphone=(self), geolocation=(self), payment=(), usb=()',
  robotsTag: 'noindex, nofollow, noarchive',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  outputFileTracingRoot: FRONTEND_ROOT,
  poweredByHeader: false,
  compress: true,
  typescript: {
    ignoreBuildErrors: false,
  },
  experimental: {
    externalDir: true,
    sri: {
      algorithm: 'sha256',
    },
  },
  turbopack: {
    root: FRONTEND_ROOT,
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
  async redirects() {
    if (!REQUIRES_EXTERNAL_HTTPS) return [];

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
