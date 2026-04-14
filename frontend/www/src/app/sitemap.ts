import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://www.lajukan.com';
  const locales = ['id', 'en'];
  const routes: Array<{
    path: string;
    priority: number;
    changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'];
  }> = [
    { path: '', priority: 0.92, changeFrequency: 'daily' },
    { path: '/home', priority: 1.0, changeFrequency: 'daily' },
    { path: '/search', priority: 1.0, changeFrequency: 'daily' },
    { path: '/jobs', priority: 0.95, changeFrequency: 'daily' },
    { path: '/property', priority: 0.95, changeFrequency: 'daily' },
    { path: '/marketplace', priority: 0.92, changeFrequency: 'daily' },
    { path: '/freelancers', priority: 0.9, changeFrequency: 'daily' },
    { path: '/forum', priority: 0.86, changeFrequency: 'daily' },
    { path: '/support', priority: 0.8, changeFrequency: 'weekly' },
    { path: '/about', priority: 0.72, changeFrequency: 'monthly' },
    { path: '/pricing', priority: 0.72, changeFrequency: 'weekly' },
    { path: '/contact', priority: 0.7, changeFrequency: 'monthly' },
    { path: '/blog', priority: 0.78, changeFrequency: 'weekly' },
    { path: '/news', priority: 0.76, changeFrequency: 'daily' },
    { path: '/community', priority: 0.74, changeFrequency: 'weekly' },
    { path: '/education', priority: 0.7, changeFrequency: 'weekly' },
    { path: '/travel', priority: 0.65, changeFrequency: 'weekly' },
    { path: '/wellness', priority: 0.65, changeFrequency: 'weekly' },
    { path: '/vendor', priority: 0.7, changeFrequency: 'weekly' },
    { path: '/hr', priority: 0.64, changeFrequency: 'monthly' },
    { path: '/investor', priority: 0.62, changeFrequency: 'monthly' },
    { path: '/analytics', priority: 0.55, changeFrequency: 'weekly' },
    { path: '/charity', priority: 0.52, changeFrequency: 'monthly' },
    { path: '/login', priority: 0.35, changeFrequency: 'monthly' },
    { path: '/register', priority: 0.4, changeFrequency: 'weekly' },
  ];

  const sitemapEntries: MetadataRoute.Sitemap = [];
  const now = new Date();

  routes.forEach((route) => {
    locales.forEach((lang) => {
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
