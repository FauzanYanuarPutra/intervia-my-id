import path from 'node:path';
import { fileURLToPath } from 'node:url';
import createNextIntlPlugin from 'next-intl/plugin';

import {
  buildPublicWebCsp,
  buildSecurityHeaders,
} from '../../packages/config/nextSecurityHeaders.mjs';

const CONFIG_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEPLOYMENT_ENV = (
  process.env.APP_ENV || process.env.ENV || process.env.NEXT_PUBLIC_APP_ENV || process.env.NODE_ENV || 'development'
).toLowerCase();
const REQUIRES_EXTERNAL_HTTPS = ['staging', 'production'].includes(DEPLOYMENT_ENV);
const WWW_ORIGIN = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '') || 'https://www.lajukan.com';
const CHAT_SERVICE_ORIGIN = process.env.INTERNAL_CHAT_SERVICE_URL || process.env.INTERNAL_CHAT_URL || 'http://chat_service:4000';
const SECURITY_HEADERS = buildSecurityHeaders({
  csp: buildPublicWebCsp({ production: REQUIRES_EXTERNAL_HTTPS }),
  production: REQUIRES_EXTERNAL_HTTPS,
  permissionsPolicy: 'camera=(self), microphone=(self), geolocation=(self), payment=(), usb=()',
  crossOriginOpenerPolicy: 'same-origin-allow-popups',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.resolve(CONFIG_DIR, '../..'),
  poweredByHeader: false,
  compress: true,
  typescript: { ignoreBuildErrors: false },
  experimental: {
    optimizeCss: false,
    externalDir: true,
    optimizePackageImports: ['lucide-react', 'framer-motion', 'recharts'],
    proxyClientMaxBodySize: '128mb',
    sri: { algorithm: 'sha256' },
  },
  async headers() {
    return [
      { source: '/:path*', headers: SECURITY_HEADERS },
      { source: '/fonts/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] },
    ];
  },
  async redirects() {
    const redirects = [
      { source: '/:locale(id|en)/search', destination: '/:locale/explore', permanent: true },
    ];
    if (REQUIRES_EXTERNAL_HTTPS) {
      redirects.push({
        source: '/:path*',
        has: [{ type: 'header', key: 'x-forwarded-proto', value: 'http' }],
        destination: `${WWW_ORIGIN}/:path*`,
        permanent: true,
      });
    }
    return redirects;
  },
  async rewrites() {
    return [{ source: '/socket/:path*', destination: `${CHAT_SERVICE_ORIGIN}/socket/:path*` }];
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60 * 60 * 24 * 7,
    remotePatterns: [
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'commons.wikimedia.org' },
      { protocol: 'https', hostname: 'upload.wikimedia.org' },
      { protocol: 'https', hostname: 'images.pexels.com' },
      { protocol: 'https', hostname: 'picsum.photos' },
      { protocol: 'https', hostname: 'i.pravatar.cc' },
      { protocol: 'https', hostname: 'i.vimeocdn.com' },
    ],
  },
};

const config = createNextIntlPlugin()(nextConfig);
const originalWebpack = config.webpack;
config.webpack = (webpackConfig, options) => {
  const result = originalWebpack ? originalWebpack(webpackConfig, options) : webpackConfig;
  result.resolve = result.resolve || {};
  result.resolve.alias = { ...(result.resolve.alias || {}), '@': path.resolve(process.cwd(), 'src') };
  result.resolve.symlinks = false;
  result.resolve.modules = [path.resolve(process.cwd(), 'node_modules'), ...(result.resolve.modules || [])];
  return result;
};

export default config;
