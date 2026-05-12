import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import withPWA from 'next-pwa';
import path from 'path';

// =======================
// CONTENT SECURITY POLICY
// =======================
const ContentSecurityPolicy = `
  default-src 'self';
  frame-ancestors 'none';
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  font-src 'self' https://fonts.gstatic.com;
  img-src 'self' data: https:;
  script-src 'self' 'unsafe-eval' 'unsafe-inline' blob:;
  connect-src 
    'self' 
    https: 
    ws:
    wss:
    http://auth.localhost 
    http://localhost:8080
    http://127.0.0.1:8080
    ws://localhost:3000
    ws://127.0.0.1:3000
    ws://localhost:4000
    ws://127.0.0.1:4000
    https://lajukan.com
    https://auth.lajukan.com
    wss://lajukan.com
    wss://www.lajukan.com
    wss://chat.lajukan.com;
`;

const CHAT_SERVICE_ORIGIN =
  process.env.INTERNAL_CHAT_SERVICE_URL || 'http://chat_service:4000';
// =======================
// NEXT CONFIG
// =======================
const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.resolve(process.cwd(), '..'),
  env: {
    JWT_SECRET: process.env.JWT_SECRET,
  },

  experimental: {
    optimizeCss: false,
    externalDir: true,
  },


  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: ContentSecurityPolicy.replace(/\s{2,}/g, ' ').trim(),
          },
        ],
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
    localPatterns: [
      {
        pathname: '/images/**',
        search: '?*',
      },
    ],
    remotePatterns: [
      { protocol: 'https', hostname: 'th.bing.com', pathname: '/**' },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        pathname: '/**',
      },
      { protocol: 'https', hostname: 'placehold.co', pathname: '/**' },
      { protocol: 'https', hostname: 'randomuser.me', pathname: '/**' },
      { protocol: 'https', hostname: 'picsum.photos', pathname: '/**' },
      { protocol: 'https', hostname: 'via.placeholder.com', pathname: '/**' },
      { protocol: 'https', hostname: 'i.pravatar.cc', pathname: '/**' },
    ],
  },
};


// =======================
// PLUGINS
// =======================
const withNextIntl = createNextIntlPlugin();

// NOTE: next-pwa sudah mengembalikan NextConfig, jadi jangan panggil lagi
const pwaNextConfig = withPWA({
  ...nextConfig,
  dest: 'out', 
  register: true,
  skipWaiting: true,
  // Disable PWA in docker/local to avoid stale chunks and cache-related runtime errors.
  disable: process.env.DISABLE_PWA !== 'false',
});

// =======================
// EXPORT FINAL
// =======================
const config = withNextIntl(pwaNextConfig) as NextConfig;

const originalWebpack = config.webpack;
config.webpack = (webpackConfig, options) => {
  const result = originalWebpack ? originalWebpack(webpackConfig, options) : webpackConfig;
  result.resolve = result.resolve || {};
  result.resolve.symlinks = false;
  result.resolve.modules = [
    path.resolve(process.cwd(), 'node_modules'),
    ...(result.resolve.modules || []),
  ];
  return result;
};

export default config;
