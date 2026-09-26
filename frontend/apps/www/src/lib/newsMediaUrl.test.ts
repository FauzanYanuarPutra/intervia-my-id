import { describe, expect, it } from 'vitest';
import { absoluteNewsMediaUrl, normalizeNewsMediaUrl } from './newsMediaUrl';

describe('news media URL policy', () => {
  it('accepts protected content media paths', () => {
    expect(normalizeNewsMediaUrl('/api/content/media/laju-chat/content/cover.webp')).toBe('/api/content/media/laju-chat/content/cover.webp');
  });

  it('rejects private, javascript, protocol-relative and traversal URLs', () => {
    expect(normalizeNewsMediaUrl('javascript:alert(1)')).toBeNull();
    expect(normalizeNewsMediaUrl('//evil.example/x.jpg')).toBeNull();
    expect(normalizeNewsMediaUrl('/api/content/media/../secret')).toBeNull();
    expect(normalizeNewsMediaUrl('http://127.0.0.1:9000/bucket/x.jpg')).toBeNull();
  });

  it('normalizes safe external URLs and resolves relative URLs for SEO', () => {
    expect(normalizeNewsMediaUrl('https://cdn.example.com/news/cover.jpg')).toBe('https://cdn.example.com/news/cover.jpg');
    expect(absoluteNewsMediaUrl('/api/content/media/laju-chat/content/cover.webp')).toContain('/api/content/media/laju-chat/content/cover.webp');
  });
});