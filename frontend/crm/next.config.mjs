import path from 'node:path';
import {
  buildInternalWebCsp,
  buildSecurityHeaders,
} from '../shared/config/nextSecurityHeaders.mjs';

const IS_PROD = process.env.NODE_ENV === 'production';
const SECURITY_HEADERS = buildSecurityHeaders({
  csp: buildInternalWebCsp({
    production: IS_PROD,
    connectSources: ['wss:', 'ws:'],
  }),
  production: IS_PROD,
  robotsTag: 'noindex, nofollow, noarchive',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  typescript: {
    ignoreBuildErrors: false,
  },
  transpilePackages: ['lajukan-ui'],
  experimental: {
    externalDir: true,
    sri: { algorithm: 'sha256' },
  },
  async headers() {
    return [{ source: '/:path*', headers: SECURITY_HEADERS }];
  },
  webpack: config => {
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      'lajukan-ui$': path.resolve(
        process.cwd(),
        'node_modules/lajukan-ui/index.ts',
      ),
    };
    config.resolve.modules = [
      path.resolve(process.cwd(), 'node_modules'),
      ...(config.resolve.modules || []),
    ];
    return config;
  },
};

export default nextConfig;
