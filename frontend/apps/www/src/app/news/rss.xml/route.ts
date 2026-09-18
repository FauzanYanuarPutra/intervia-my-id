import { buildNewsUrl, getPublishedNews } from '@/lib/news';

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function GET() {
  const { items } = await getPublishedNews({ language: 'id', limit: 50 });
  const channelUrl = buildNewsUrl('id');

  const entries = items
    .map(article => {
      const locale = article.language === 'en' ? 'en' : 'id';
      const url = buildNewsUrl(locale, article.slug);
      return `    <item>
      <title>${escapeXml(article.title)}</title>
      <link>${escapeXml(url)}</link>
      <guid isPermaLink="true">${escapeXml(url)}</guid>
      <pubDate>${new Date(article.publishedAt).toUTCString()}</pubDate>
      <category>${escapeXml(article.category)}</category>
      <description>${escapeXml(article.summary)}</description>
    </item>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Lajukan News</title>
    <link>${escapeXml(channelUrl)}</link>
    <description>Berita ekonomi, bisnis, UMKM, teknologi, regulasi, dan daerah untuk pelaku usaha.</description>
    <language>id-ID</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${entries}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=30, s-maxage=60, stale-while-revalidate=60',
    },
  });
}
