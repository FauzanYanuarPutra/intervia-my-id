import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildInternalWebCsp,
  buildSecurityHeaders,
} from '../../packages/config/nextSecurityHeaders.mjs';

const configDir = path.dirname(fileURLToPath(import.meta.url));
const isProd = process.env.NODE_ENV === 'production';
const configuredUsahaOrigin = (
  process.env.NEXT_PUBLIC_USAHA_URL || ''
).replace(/\/$/, '');
const usahaOrigin = configuredUsahaOrigin.startsWith('https://')
  ? configuredUsahaOrigin
  : 'https://usaha.lajukan.com';

const securityHeaders = buildSecurityHeaders({
  csp: buildInternalWebCsp({
    production: isProd,
    connectSources: ['https:', 'wss:', 'ws:'],
  }),
  production: isProd,
  permissionsPolicy:
    'camera=(self), microphone=(self), geolocation=(self), payment=(), usb=()',
  robotsTag: 'noindex, nofollow, noarchive',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',

  outputFileTracingRoot: path.resolve(
    CONFIG_DIR,
    '../..',
  ),

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
    root: path.resolve(configDir),
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
