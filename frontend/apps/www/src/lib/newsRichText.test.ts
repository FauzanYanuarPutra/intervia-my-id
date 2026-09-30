import { describe, expect, it } from 'vitest';
import { normalizeNewsRichBody, plainTextToNewsHtml, sanitizeNewsRichText } from './newsRichText';

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

  it('normalizes plain rich-body values into real paragraphs', () => {
    expect(normalizeNewsRichBody('A\nB\n\nC', '')).toBe('<p>A<br />B</p><p>C</p>');
  });

  it('normalizes escaped Windows line endings, tabs, Unicode separators, and null bytes', () => {
    expect(
      normalizeNewsRichBody('A\\r\\nB\\n\\nC\\tD\\u2028E\\u2029F\\u0000', ''),
    ).toBe('<p>A<br />B</p><p>C    D<br />E<br />F</p>');
  });

  it('escapes HTML when normalizing plain rich-body text', () => {
    expect(normalizeNewsRichBody('<script>alert(1)</script> & text', '')).toBe(
      '<p>&lt;script&gt;alert(1)&lt;/script&gt; &amp; text</p>',
    );
  });

  it('keeps real rich HTML instead of flattening its block structure', () => {
    expect(normalizeNewsRichBody('<p>A</p><p>B</p>', 'fallback')).toBe('<p>A</p><p>B</p>');
  });
});