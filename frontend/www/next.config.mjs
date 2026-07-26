import path from 'node:path';
import createNextIntlPlugin from 'next-intl/plugin';

import {
  buildPublicWebCsp,
  buildSecurityHeaders,
} from '../shared/config/nextSecurityHeaders.mjs';

const IS_PROD = process.env.NODE_ENV === 'production';
const FAST_DOCKER_BUILD = process.env.FAST_DOCKER_BUILD === 'true';
const WWW_ORIGIN =
  (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '') ||
  'https://www.lajukan.com';
const CHAT_SERVICE_ORIGIN =
  process.env.INTERNAL_CHAT_SERVICE_URL ||
  process.env.INTERNAL_CHAT_URL ||
  'http://chat_service:4000';
const SECURITY_HEADERS = buildSecurityHeaders({
  csp: buildPublicWebCsp({ production: IS_PROD }),
  production: IS_PROD,
  permissionsPolicy:
    'camera=(self), microphone=(self), geolocation=(self), payment=(), usb=()',
  crossOriginOpenerPolicy: 'same-origin-allow-popups',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.resolve(process.cwd(), '..'),
  poweredByHeader: false,
  compress: true,
  typescript: {
    ignoreBuildErrors: FAST_DOCKER_BUILD,
  },
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
      {
        source: '/fonts/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
  async redirects() {
    if (!IS_PROD) return [];
    return [
      {
        source: '/:path*',
        has: [
          { type: 'header', key: 'x-forwarded-proto', value: 'http' },
        ],
        destination: `${WWW_ORIGIN}/:path*`,
        permanent: true,
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: '/socket/:path*',
        destination: `${CHAT_SERVICE_ORIGIN}/socket/:path*`,
      },
    ];
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
  const result = originalWebpack
    ? originalWebpack(webpackConfig, options)
    : webpackConfig;

  result.resolve = result.resolve || {};
  result.resolve.alias = {
    ...(result.resolve.alias || {}),
    '@': path.resolve(process.cwd(), 'src'),
  };
  result.resolve.symlinks = false;
  result.resolve.modules = [
    path.resolve(process.cwd(), 'node_modules'),
    ...(result.resolve.modules || []),
  ];
  return result;
};

export default config;
