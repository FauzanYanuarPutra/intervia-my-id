import createNextIntlPlugin from 'next-intl/plugin';
import withPWA from 'next-pwa';
import path from 'path';

const IS_PROD = process.env.NODE_ENV === 'production';
const FAST_DOCKER_BUILD = process.env.FAST_DOCKER_BUILD === 'true';
const scriptSrc = IS_PROD
  ? "script-src 'self' 'unsafe-inline' blob:;"
  : "script-src 'self' 'unsafe-eval' 'unsafe-inline' blob:;";

const ContentSecurityPolicy = `
  default-src 'self';
  frame-ancestors 'none';
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  font-src 'self' https://fonts.gstatic.com;
  img-src 'self' data: https:;
  ${scriptSrc}
  connect-src 
    'self' 
    https: 
    ws:
    wss:
    stun:
    turn:
    turns:
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

const CHAT_SERVICE_ORIGIN = process.env.INTERNAL_CHAT_SERVICE_URL || 'http://chat_service:4000';

const nextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.resolve(process.cwd(), '..'),
  eslint: {
    ignoreDuringBuilds: FAST_DOCKER_BUILD,
  },
  typescript: {
    ignoreBuildErrors: FAST_DOCKER_BUILD,
  },
  experimental: {
    optimizeCss: false,
    cssChunking: false,
    externalDir: true,
  },
  async headers() {
    const csp = ContentSecurityPolicy.replace(/\s{2,}/g, ' ').trim();
    const securityHeaders = [
      { key: 'Content-Security-Policy', value: csp },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=(self)' },
    ];
    if (process.env.NODE_ENV === 'production') {
      securityHeaders.push({
        key: 'Strict-Transport-Security',
        value: 'max-age=31536000; includeSubDomains; preload',
      });
    }
    return [{ source: '/:path*', headers: securityHeaders }];
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
    remotePatterns: [
      { protocol: 'https', hostname: 'th.bing.com', pathname: '/**' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com', pathname: '/**' },
      { protocol: 'https', hostname: 'placehold.co', pathname: '/**' },
      { protocol: 'https', hostname: 'randomuser.me', pathname: '/**' },
      { protocol: 'https', hostname: 'picsum.photos', pathname: '/**' },
      { protocol: 'https', hostname: 'via.placeholder.com', pathname: '/**' },
      { protocol: 'https', hostname: 'i.pravatar.cc', pathname: '/**' },
    ],
  },
};

const withNextIntl = createNextIntlPlugin();

const pwaNextConfig = withPWA({
  ...nextConfig,
  dest: 'out',
  register: true,
  skipWaiting: true,
  // Disable PWA in docker/local to avoid stale chunks and cache-related runtime errors.
  disable: process.env.DISABLE_PWA !== 'false',
});

const config = withNextIntl(pwaNextConfig);

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
