import { describe, expect, it } from 'vitest';
import { plainTextToNewsHtml, sanitizeNewsRichText } from './newsRichText';

describe('news rich text hardening', () => {
  it('removes executable tags and event/style attributes', () => {
    const result = sanitizeNewsRichText('<p>Hello</p><img src="/api/content/media/laju-chat/content/x.webp" onerror="alert(1)" style="background:url(javascript:alert(1))"><script>alert(1)</script>');
    expect(result).toContain('<p>Hello</p>');
    expect(result).not.toContain('onerror');
    expect(result).not.toContain('style=');
    expect(result).not.toContain('<script>');
  });

  it('keeps supported formatting and safe media links', () => {
    const result = sanitizeNewsRichText('<h2>Judul</h2><p><strong>Tebal</strong><br>Baris</p><a href="https://www.bi.go.id/">BI</a><img src="/api/content/media/laju-chat/content/x.webp" alt="Foto">');
    expect(result).toContain('<h2>Judul</h2>');
    expect(result).toContain('<strong>Tebal</strong>');
    expect(result).toContain('<br>Baris</p>');
    expect(result).toContain('target="_blank"');
    expect(result).toContain('/api/content/media/laju-chat/content/x.webp');
  });

  it('preserves paragraph and line-break structure from plain text', () => {
    expect(plainTextToNewsHtml('A\nB\n\nC')).toBe('<p>A<br />B</p><p>C</p>');
  });
});