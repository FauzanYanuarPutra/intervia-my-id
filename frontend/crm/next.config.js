/** @type {import('next').NextConfig} */
const FAST_DOCKER_BUILD = process.env.FAST_DOCKER_BUILD === 'true';

const nextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: FAST_DOCKER_BUILD,
  },
  transpilePackages: ['lajukan-ui'],
  experimental: {
    externalDir: true,
  },
};

module.exports = nextConfig;
