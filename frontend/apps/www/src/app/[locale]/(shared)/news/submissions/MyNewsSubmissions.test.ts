import { describe, expect, it } from 'vitest';
import { submissionFormFromItem } from './MyNewsSubmissions';

describe('submissionFormFromItem', () => {
  it('hydrates editable fields while excluding internal routing tags', () => {
    const form = submissionFormFromItem({
      id: 'news-1',
      title: 'QRIS untuk UMKM',
      summary: 'Ringkasan',
      body: 'Isi berita',
      tags: ['news', 'ekonomi', 'analysis', 'qris', 'harga pangan'],
      content_status: 'draft',
      metadata: {
        news: {
          category: 'Ekonomi',
          article_kind: 'analysis',
          location: 'Banten',
          source_urls: ['https://www.bi.go.id/example'],
        },
      },
      updated_at: '2026-09-18T00:00:00Z',
    });

    expect(form).toEqual({
      title: 'QRIS untuk UMKM',
      summary: 'Ringkasan',
      body: 'Isi berita',
      category: 'Ekonomi',
      article_kind: 'analysis',
      location: 'Banten',
      topics: 'qris, harga pangan',
      source_urls: 'https://www.bi.go.id/example',
    });
  });
});
