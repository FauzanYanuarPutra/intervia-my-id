import { MetadataRoute } from 'next';

const PRIVATE_ROUTE_PATHS = [
  'chat',
  'create',
  'dashboard',
  'login',
  'register',
  'forgot-password',
  'reset-password',
  'transactions',
  'payments',
  'notifications',
  'settings',
  'my-projects',
  'my-listings',
  'onboarding',
];

const DISALLOW_ROUTES = [
  '/api/',
  '/private/',
  '/admin/',
  '/tmp/',
  ...['id', 'en'].flatMap(locale => [
    ...PRIVATE_ROUTE_PATHS.map(path => `/${locale}/${path}`),

    // Owner profile only.
    // Jangan gunakan `/${locale}/profile` karena public profile
    // berada di bawah /profile/[slug].
    `/${locale}/profile$`,

    `/${locale}/content/*/edit`,
  ]),
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: DISALLOW_ROUTES,
      },
      {
        userAgent: ['Googlebot', 'Googlebot-Image', 'Googlebot-News'],
        allow: '/',
        disallow: DISALLOW_ROUTES,
      },
      {
        userAgent: 'Bingbot',
        allow: '/',
        disallow: DISALLOW_ROUTES,
      },
    ],
    sitemap: ['https://www.lajukan.com/sitemap.xml'],
    host: 'https://www.lajukan.com',
  };
}