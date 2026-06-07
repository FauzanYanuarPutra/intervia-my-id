import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://www.lajukan.com';
  const locales = ['id', 'en'];
  const routes: Array<{
    path: string;
    priority: number;
    changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'];
  }> = [
    { path: '/home', priority: 1.0, changeFrequency: 'daily' },
    { path: '/search', priority: 1.0, changeFrequency: 'daily' },
    { path: '/kategori', priority: 0.88, changeFrequency: 'daily' },
    { path: '/umkm', priority: 0.92, changeFrequency: 'daily' },
    { path: '/community', priority: 0.86, changeFrequency: 'daily' },
    { path: '/reels', priority: 0.8, changeFrequency: 'daily' },
    { path: '/learn', priority: 0.82, changeFrequency: 'daily' },
    { path: '/education', priority: 0.8, changeFrequency: 'weekly' },
    { path: '/microgigs', priority: 0.7, changeFrequency: 'daily' },
    { path: '/crm', priority: 0.62, changeFrequency: 'weekly' },
    { path: '/lainnya', priority: 0.68, changeFrequency: 'weekly' },
    { path: '/support', priority: 0.8, changeFrequency: 'weekly' },
    { path: '/trust', priority: 0.76, changeFrequency: 'monthly' },
    { path: '/about', priority: 0.72, changeFrequency: 'monthly' },
    { path: '/contact', priority: 0.7, changeFrequency: 'monthly' },
    { path: '/privacy', priority: 0.62, changeFrequency: 'monthly' },
    { path: '/terms', priority: 0.62, changeFrequency: 'monthly' },
    { path: '/cookie-policy', priority: 0.5, changeFrequency: 'monthly' },
  ];

  const sitemapEntries: MetadataRoute.Sitemap = [];
  const now = new Date();

  routes.forEach(route => {
    locales.forEach(lang => {
      sitemapEntries.push({
        url: `${baseUrl}/${lang}${route.path}`,
        lastModified: now,
        changeFrequency: route.changeFrequency,
        priority: route.priority,
        alternates: {
          languages: {
            id: `${baseUrl}/id${route.path}`,
            en: `${baseUrl}/en${route.path}`,
            'x-default': `${baseUrl}/id${route.path}`,
          },
        },
      });
    });
  });

  return sitemapEntries;
}
