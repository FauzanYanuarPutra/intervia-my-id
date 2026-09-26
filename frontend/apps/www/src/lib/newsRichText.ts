import { normalizeNewsMediaUrl } from './newsMediaUrl';

const ALLOWED_BLOCK_TAGS = new Set([
  'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'h2', 'h3',
  'blockquote', 'ul', 'ol', 'li', 'a', 'img', 'figure', 'figcaption', 'pre', 'code',
]);

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function readAttrs(raw: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const pattern = /([a-zA-Z_:][a-zA-Z0-9:._-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(raw))) {
    const name = match[1]!.toLowerCase();
    if (name === 'href' || name === 'src' || name === 'alt' || name === 'title') {
      attrs[name] = match[2] ?? match[3] ?? match[4] ?? '';
    }
  }
  return attrs;
}

function textToParagraphs(text: string): string {
  const normalized = text
    .replace(/\r\n?/g, '\n')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\t/g, '    ')
    .trim();
  if (!normalized) return '';
  return normalized
    .split(/\n{2,}/)
    .map(paragraph => paragraph.split('\n').map(line => line.replace(/ {2,}/g, spaces => '&nbsp;'.repeat(spaces.length - 1) + ' ')).join('<br />'))
    .filter(Boolean)
    .map(paragraph => `<p>${paragraph}</p>`)
    .join('');
}

export function plainTextToNewsHtml(text: string): string {
  return textToParagraphs(text);
}

export function sanitizeNewsRichText(value: string, maxLength = 60_000): string {
  const input = String(value ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/[\u200B-\u200D\uFEFF]/g, '');
  const tagPattern = /<!--[\s\S]*?-->|<![^>]*>|<\/?[a-zA-Z][^>]*>/g;
  let output = '';
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = tagPattern.exec(input))) {
    output += input.slice(cursor, match.index);
    cursor = match.index + match[0].length;
    const token = match[0];
    if (token.startsWith('<!--') || token.startsWith('<!')) continue;

    const closing = /^<\s*\/\s*([a-zA-Z0-9]+)[^>]*>$/.exec(token);
    if (closing) {
      const tag = closing[1]!.toLowerCase();
      if (ALLOWED_BLOCK_TAGS.has(tag) && tag !== 'br' && tag !== 'img') output += `</${tag}>`;
      continue;
    }

    const opening = /^<\s*([a-zA-Z0-9]+)([\s\S]*?)>$/i.exec(token);
    if (!opening) continue;
    const tag = opening[1]!.toLowerCase();
    if (!ALLOWED_BLOCK_TAGS.has(tag)) continue;

    if (tag === 'a') {
      const attrs = readAttrs(opening[2] || '');
      const href = normalizeNewsMediaUrl(attrs.href);
      if (!href) { output += '<a>'; continue; }
      output += '<a href="' + escapeAttr(href) + '" target="_blank" rel="noopener noreferrer nofollow">';
      continue;
    }

    if (tag === 'img') {
      const attrs = readAttrs(opening[2] || '');
      const src = normalizeNewsMediaUrl(attrs.src);
      if (!src) continue;
      const alt = String(attrs.alt || '').slice(0, 300);
      output += '<img src="' + escapeAttr(src) + '" alt="' + escapeAttr(alt) + '" loading="lazy" />';
      continue;
    }

    output += `<${tag}>`;
  }

  output += input.slice(cursor);
  return output.slice(0, Math.max(1, maxLength)).trim();
}