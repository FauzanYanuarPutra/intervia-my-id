import { NextRequest, NextResponse } from 'next/server';
import { normalizeSafeExternalHttpUrl } from 'lajukan-ui';
import { enforceRateLimit, getClientIp } from '@/lib/rateLimit';
import { requireAuth } from '@/lib/serverAuth';
import { parseJsonBody } from '@/lib/serverRequest';
import { evaluateTrustSafety } from '@/lib/trustSafety';

const MARKETPLACE_URL = (process.env.INTERNAL_MARKETPLACE_URL || process.env.MARKETPLACE_URL || process.env.NEXT_PUBLIC_MARKETPLACE_URL || 'http://localhost:8081').replace(/\/+$/, '');

function readString(value: unknown): string { return typeof value === 'string' ? value.trim() : ''; }
function readTopics(value: unknown): string[] {
  const raw = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [];
  const out: string[] = [];
  for (const entry of raw) {
    const topic = readString(entry).toLowerCase().replace(/\s+/g, ' ');
    if (!topic || topic.length > 40 || !/^[\p{L}\p{N}][\p{L}\p{N}\s._-]*$/u.test(topic) || out.includes(topic)) continue;
    out.push(topic);
    if (out.length >= 8) break;
  }
  return out;
}
function safeUrl(value: string): boolean { return normalizeSafeExternalHttpUrl(value) !== null; }
function sanitizeRichText(value: string): string {
  let html = value.replace(/<!--[\s\S]*?-->/g, '');
  html = html.replace(/<\/?(script|style|iframe|object|embed|form|input|button|textarea|select|svg|math)[^>]*>/gi, '');
  html = html.replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  html = html.replace(/(href|src)\s*=\s*(['"]?)\s*(javascript:|data:|vbscript:)[^'">\s]*\2/gi, '$1=$2$2');
  html = html.replace(/<img([^>]*)>/gi, (_m, attrs) => {
    const src = attrs.match(/\ssrc\s*=\s*(['"])(.*?)\1/i)?.[2] || '';
    const alt = attrs.match(/\salt\s*=\s*(['"])(.*?)\1/i)?.[2] || '';
    return safeUrl(src) ? '<img src="' + src.replace(/"/g, '&quot;') + '" alt="' + alt.replace(/"/g, '&quot;').slice(0,300) + '" loading="lazy" />' : '';
  });
  html = html.replace(/<a([^>]*)href\s*=\s*(['"])(.*?)\2([^>]*)>/gi, (_m, before, _q, href, after) => {
    try {
      const url = new URL(href);
      if (!['http:','https:'].includes(url.protocol) || !safeUrl(url.toString())) return '<a>';
      return '<a' + before + ' href="' + url.toString().replace(/"/g, '&quot;') + '" target="_blank" rel="noopener noreferrer nofollow"' + after + '>';
    } catch { return '<a>'; }
  });
  html = html.replace(/<(?!\/?(?:p|br|strong|b|em|i|u|s|h2|h3|blockquote|ul|ol|li|a|img|figure|figcaption|pre|code)(?:\s|>|\/))[^>]*>/gi, '');
  return html.slice(0, 60000);
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.res;
  const rate = await enforceRateLimit({ key: 'blog:mine:user:' + auth.ctx.userId, limit: 120, windowSeconds: 3600 });
  if (!rate.ok) return rate.response;
  const upstream = await fetch(MARKETPLACE_URL + '/v1/blog/submissions/mine', { headers: { Authorization: 'Bearer ' + auth.ctx.token }, cache: 'no-store' });
  const text = await upstream.text();
  return new NextResponse(text, { status: upstream.status, headers: { 'Content-Type': upstream.headers.get('content-type') || 'application/json' } });
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.res;
  const ipRate = await enforceRateLimit({ key: 'blog:create:ip:' + getClientIp(request), limit: 20, windowSeconds: 3600 });
  if (!ipRate.ok) return ipRate.response;
  const userRate = await enforceRateLimit({ key: 'blog:create:user:' + auth.ctx.userId, limit: 10, windowSeconds: 3600 });
  if (!userRate.ok) return userRate.response;
  const parsed = await parseJsonBody(request);
  if (!parsed.ok) return parsed.response;
  const payload = parsed.data as Record<string, unknown>;
  const title = readString(payload.title);
  const summary = readString(payload.summary);
  const body = readString(payload.body);
  const richBody = sanitizeRichText(readString(payload.rich_body));
  const category = readString(payload.category) || 'UMKM';
  const language = readString(payload.language) || 'id';
  const authorName = readString(payload.author_name) || 'Lajukan Community';
  const publicationMode = readString(payload.publication_mode) || 'review';
  const coverImage = readString(payload.cover_image);
  const topics = readTopics(payload.topics);
  if (title.length < 10 || title.length > 180) return NextResponse.json({ error: 'Judul harus 10-180 karakter.' }, { status: 422 });
  if (summary.length < 20 || summary.length > 1000) return NextResponse.json({ error: 'Ringkasan harus 20-1000 karakter.' }, { status: 422 });
  if (body.length < 120 || body.length > 20000) return NextResponse.json({ error: 'Isi artikel harus 120-20.000 karakter.' }, { status: 422 });
  if (!['id','en'].includes(language)) return NextResponse.json({ error: 'Bahasa tidak didukung.' }, { status: 422 });
  if (!['review','instant'].includes(publicationMode)) return NextResponse.json({ error: 'Mode publikasi tidak didukung.' }, { status: 422 });
  if (coverImage && !safeUrl(coverImage)) return NextResponse.json({ error: 'URL gambar sampul tidak valid.' }, { status: 422 });

  const safety = [evaluateTrustSafety(title, { maxLength: 180, allowExternalLinks: false, enforceOffPlatformPayment: false }),
    evaluateTrustSafety(summary, { maxLength: 1000, allowExternalLinks: false, enforceOffPlatformPayment: false }),
    evaluateTrustSafety(body, { maxLength: 20000, allowExternalLinks: false, enforceOffPlatformPayment: false })];
  const violations = safety.flatMap(item => item.ok ? [] : item.violations.map(v => v.code));
  if (violations.length) return NextResponse.json({ error: 'Konten melewati batas keamanan.', violations }, { status: 422 });
  if (!richBody) return NextResponse.json({ error: 'Isi artikel kosong.' }, { status: 422 });

  const upstream = await fetch(MARKETPLACE_URL + '/v1/blog', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + auth.ctx.token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, summary, body, rich_body: richBody, category, language, topics, author_name: authorName, publication_mode: publicationMode, ...(coverImage ? { cover_image: coverImage } : {}) }),
    cache: 'no-store',
  });
  const text = await upstream.text();
  return new NextResponse(text, { status: upstream.status, headers: { 'Content-Type': upstream.headers.get('content-type') || 'application/json' } });
}
