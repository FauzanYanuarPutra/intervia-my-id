import { MetadataRoute } from 'next';

const DISALLOW_ROUTES = ['/api/', '/private/', '/admin/', '/tmp/'];

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
