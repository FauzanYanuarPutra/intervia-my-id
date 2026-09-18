import { describe, expect, it } from 'vitest';
import { buildNewsArticleJsonLd, normalizeNewsArticle } from './news';

describe('news SEO normalization', () => {
  it('normalizes editorial metadata and keeps valid citations', () => {
    const article = normalizeNewsArticle({
      id: '11111111-1111-1111-1111-111111111111',
      slug: 'ekonomi-umkm',
      title: 'Ekonomi UMKM bergerak',
      summary: 'Ringkasan berita',
      body: 'Isi berita',
      tags: ['ekonomi', 'umkm'],
      metadata: {
        news: {
          category: 'Ekonomi',
          article_kind: 'news',
          source_urls: ['https://www.bi.go.id/example', 'javascript:alert(1)'],
          location: 'Banten',
        },
      },
      published_at: '2026-09-18T01:00:00Z',
      created_at: '2026-09-18T00:00:00Z',
      updated_at: '2026-09-18T02:00:00Z',
    });

    expect(article?.category).toBe('Ekonomi');
    expect(article?.sourceUrls).toEqual(['https://www.bi.go.id/example']);
    expect(article?.location).toBe('Banten');
  });

  it('keeps retraction state while hiding reserved system tags from public topics', () => {
    const article = normalizeNewsArticle({
      id: '11111111-1111-1111-1111-111111111111',
      slug: 'ditarik',
      title: 'Berita yang ditarik',
      summary: 'Ringkasan berita yang sudah ditarik.',
      body: 'Isi lama',
      tags: ['news', 'ekonomi', 'analysis', 'qris', 'harga pangan'],
      content_status: 'archived',
      metadata: {
        news: {
          category: 'Ekonomi',
          article_kind: 'analysis',
          editorial_status: 'retracted',
          retraction_note: 'Sumber utama tidak lagi dapat diverifikasi.',
        },
      },
      created_at: '2026-09-18T00:00:00Z',
      updated_at: '2026-09-18T01:00:00Z',
    });

    expect(article?.editorialStatus).toBe('retracted');
    expect(article?.retractionNote).toContain('tidak lagi');
    expect(article?.tags).toEqual(['qris', 'harga pangan']);
  });

  it('emits NewsArticle structured data', () => {
    const article = normalizeNewsArticle({
      id: '11111111-1111-1111-1111-111111111111',
      slug: 'contoh',
      title: 'Contoh berita ekonomi',
      summary: 'Ringkasan',
      body: 'Isi',
      metadata: { news: { category: 'Ekonomi' } },
      created_at: '2026-09-18T00:00:00Z',
      updated_at: '2026-09-18T01:00:00Z',
    });
    expect(article).not.toBeNull();
    const jsonLd = buildNewsArticleJsonLd(article!, 'id');
    expect(jsonLd['@type']).toBe('NewsArticle');
    expect(jsonLd.headline).toBe('Contoh berita ekonomi');
  });
});
