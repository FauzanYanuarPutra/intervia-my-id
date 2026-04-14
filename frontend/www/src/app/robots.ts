import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/private/', '/admin/', '/tmp/'],
      },
      {
        userAgent: ['Googlebot', 'Googlebot-Image', 'Googlebot-News'],
        allow: '/',
        disallow: ['/private/', '/admin/', '/tmp/'],
      },
      {
        userAgent: 'Bingbot',
        allow: '/',
        disallow: ['/private/', '/admin/', '/tmp/'],
      },
    ],
    sitemap: ['https://www.lajukan.com/sitemap.xml'],
    host: 'https://www.lajukan.com',
  };
}
