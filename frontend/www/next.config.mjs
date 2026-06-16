import createNextIntlPlugin from 'next-intl/plugin';
import withPWA from 'next-pwa';
import path from 'node:path';

const IS_PROD = process.env.NODE_ENV === 'production';
const FAST_DOCKER_BUILD = process.env.FAST_DOCKER_BUILD === 'true';
const configuredWwwOrigin = (process.env.NEXT_PUBLIC_APP_URL || '').replace(
  /\/$/,
  '',
);
const WWW_ORIGIN = configuredWwwOrigin.startsWith('https://')
  ? configuredWwwOrigin
  : 'https://www.lajukan.com';
const scriptSrc = IS_PROD
  ? "script-src 'self' 'unsafe-inline' blob:;"
  : "script-src 'self' 'unsafe-eval' 'unsafe-inline' blob:;";
const upgradeInsecureRequests = IS_PROD ? 'upgrade-insecure-requests;' : '';

const ContentSecurityPolicy = `
  default-src 'self';
  base-uri 'self';
  frame-ancestors 'none';
  object-src 'none';
  form-action 'self';
  manifest-src 'self';
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  font-src 'self' https://fonts.gstatic.com;
  img-src 'self' data: blob: https:;
  media-src 'self' data: blob: https:;
  worker-src 'self' blob:;
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
    http://localhost:8081
    http://127.0.0.1:8081
    ws://localhost:3000
    ws://127.0.0.1:3000
    ws://localhost:4000
    ws://127.0.0.1:4000
    https://lajukan.com
    https://auth.lajukan.com
    wss://lajukan.com
    wss://www.lajukan.com
    wss://chat.lajukan.com;
  ${upgradeInsecureRequests}
`;

const CHAT_SERVICE_ORIGIN =
  process.env.INTERNAL_CHAT_SERVICE_URL ||
  process.env.INTERNAL_CHAT_URL ||
  'http://chat_service:4000';
const DEAD_MARKETING_ROUTES = [
  'pricing',
  'blog',
  'news',
  'travel',
  'wellness',
  'vendor',
  'hr',
  'investor',
  'analytics',
  'charity',
];

const deadMarketingRedirects = DEAD_MARKETING_ROUTES.flatMap(route => [
  {
    source: `/:locale(id|en)/${route}/:slug*`,
    destination: '/:locale/home',
    permanent: true,
  },
  {
    source: `/${route}/:slug*`,
    destination: '/id/home',
    permanent: true,
  },
]);
const legacyRouteRedirects = [
  { route: 'finance', destination: '/payments' },
  { route: 'collaboration', destination: '/chat' },
  { route: 'spatial', destination: '/umkm' },
].flatMap(({ route, destination }) => [
  {
    source: `/:locale(id|en)/${route}/:slug*`,
    destination: `/:locale${destination}`,
    permanent: true,
  },
  {
    source: `/${route}/:slug*`,
    destination: `/id${destination}`,
    permanent: true,
  },
]);

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
    cssChunking: false,
    externalDir: true,
    optimizePackageImports: ['lucide-react', 'framer-motion', 'recharts'],
  },
  async headers() {
    const csp = ContentSecurityPolicy.replace(/\s{2,}/g, ' ').trim();
    const securityHeaders = [
      { key: 'Content-Security-Policy', value: csp },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'X-DNS-Prefetch-Control', value: 'on' },
      { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
      { key: 'Origin-Agent-Cluster', value: '?1' },
      { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
      { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      {
        key: 'Permissions-Policy',
        value: 'camera=(self), microphone=(self), geolocation=(self)',
      },
    ];

    if (IS_PROD) {
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
    const productionRedirects = IS_PROD
      ? [
          {
            source: '/:path*',
            has: [{ type: 'header', key: 'x-forwarded-proto', value: 'http' }],
            destination: `${WWW_ORIGIN}/:path*`,
            permanent: true,
          },
        ]
      : [];

    return [
      ...deadMarketingRedirects,
      ...legacyRouteRedirects,
      ...productionRedirects,
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
    localPatterns: [
      {
        pathname: '/images/**',
      },
      {
        pathname: '/uploads/**',
      },
      {
        pathname: '/api/content/media/**',
      },
      {
        pathname: '/api/chat/media/**',
      },
      {
        pathname: '/api/forum/media/**',
      },
      { pathname: '/default-avatar.svg' },
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
      { protocol: 'https', hostname: 'images.unsplash.com', pathname: '/**' },
      { protocol: 'https', hostname: 'picsum.photos', pathname: '/**' },
      { protocol: 'https', hostname: 'via.placeholder.com', pathname: '/**' },
      { protocol: 'https', hostname: 'i.pravatar.cc', pathname: '/**' },
    ],
  },
};

const withNextIntl = createNextIntlPlugin();
const shouldEnablePwa = process.env.DISABLE_PWA === 'false';
const pwaNextConfig = shouldEnablePwa
  ? withPWA({
      ...nextConfig,
      dest: 'out',
      register: true,
      skipWaiting: true,
      disable: false,
    })
  : nextConfig;

const config = withNextIntl(pwaNextConfig);
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
