import { getNewsForSitemap, buildNewsUrl } from '@/lib/news';

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function GET() {
  const cutoff = Date.now() - 48 * 60 * 60 * 1000;
  const articles = (await getNewsForSitemap(1000))
    .filter(article => new Date(article.publishedAt).getTime() >= cutoff)
    .slice(0, 1000);

  const urls = articles
    .map(article => {
      const locale = article.language === 'en' ? 'en' : 'id';
      const language = article.language === 'en' ? 'en' : 'id';
      return `  <url>
    <loc>${escapeXml(buildNewsUrl(locale, article.slug))}</loc>
    <news:news>
      <news:publication>
        <news:name>Lajukan</news:name>
        <news:language>${language}</news:language>
      </news:publication>
      <news:publication_date>${escapeXml(article.publishedAt)}</news:publication_date>
      <news:title>${escapeXml(article.title)}</news:title>
    </news:news>
  </url>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${urls}
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=30, s-maxage=60, stale-while-revalidate=60',
    },
  });
}
