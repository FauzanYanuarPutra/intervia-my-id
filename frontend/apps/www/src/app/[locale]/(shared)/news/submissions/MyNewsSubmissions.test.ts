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
          rich_body: '<p>Isi <strong>berita</strong></p>',
          source_urls: ['https://www.bi.go.id/example'],
        },
      },
      cover_image: 'https://cdn.example.com/news-cover.jpg',
      created_at: '2026-09-17T00:00:00Z',
      published_at: null,
      updated_at: '2026-09-18T00:00:00Z',
    });

    expect(form).toEqual({
      title: 'QRIS untuk UMKM',
      summary: 'Ringkasan',
      body: 'Isi berita',
      rich_body: '<p>Isi <strong>berita</strong></p>',
      category: 'Ekonomi',
      article_kind: 'analysis',
      location: 'Banten',
      cover_image: 'https://cdn.example.com/news-cover.jpg',
      topics: 'qris, harga pangan',
      source_urls: 'https://www.bi.go.id/example',
    });
  });
});


describe('submissionFormFromItem fallback', () => {
  it('creates editable paragraph markup when an older submission has no rich body', () => {
    const form = submissionFormFromItem({
      id: 'news-legacy',
      title: 'Berita lama',
      summary: 'Ringkasan lama',
      body: 'Paragraf satu\n\nParagraf dua',
      content_status: 'draft',
      created_at: '2026-09-17T00:00:00Z',
      updated_at: '2026-09-18T00:00:00Z',
      metadata: {
        news: {
          category: 'Bisnis',
          article_kind: 'news',
        },
      },
    });

    expect(form.rich_body).toContain('<p>Paragraf satu</p>');
    expect(form.rich_body).toContain('<p>Paragraf dua</p>');
    expect(form.cover_image).toBe('');
  });
});
