import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/serverAuth';
import { parseJsonBody } from '@/lib/serverRequest';
import { enforceRateLimit } from '@/lib/rateLimit';
import { evaluateTrustSafety } from '@/lib/trustSafety';

const MARKETPLACE_URL = (
  process.env.INTERNAL_MARKETPLACE_URL ||
  process.env.MARKETPLACE_URL ||
  'http://localhost:8081'
).replace(/\/+$/, '');

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

const CATEGORIES = new Set([
  'Ekonomi',
  'Bisnis',
  'UMKM',
  'Teknologi',
  'Keuangan',
  'Regulasi',
  'Industri',
  'Daerah',
]);

const ARTICLE_KINDS = new Set(['news', 'analysis', 'press_release']);

function isPrivateSourceHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) {
    return true;
  }
  if (
    host.includes(':') &&
    (host === '::' ||
      host === '::1' ||
      host.startsWith('fc') ||
      host.startsWith('fd') ||
      /^fe[89ab]/.test(host))
  ) {
    return true;
  }
  const parts = host.split('.').map(Number);
  if (parts.length === 4 && parts.every(part => Number.isInteger(part) && part >= 0 && part <= 255)) {
    const [a, b] = parts;
    return (
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a === 0
    );
  }
  return false;
}

function sanitizeText(value: string, maxLength: number) {
  return evaluateTrustSafety(value, {
    maxLength,
    allowExternalLinks: false,
    enforceOffPlatformPayment: false,
  });
}

function isSafePublicUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !isPrivateSourceHost(url.hostname);
  } catch {
    return false;
  }
}

function sanitizeRichText(value: string, maxLength: number) {
  let html = value.replace(/<!--([\\s\\S]*?)-->/g, '');
  html = html.replace(/<\\/?(script|style|iframe|object|embed|form|input|button|textarea|select|svg|math)[^>]*>/gi, '');
  html = html.replace(/\\s+on[a-z]+\\s*=\\s*(?:"[^"]*"|'[^']*'|[^\\s>]+)/gi, '');
  html = html.replace(/(href|src)\\s*=\\s*(['"]?)\\s*(javascript:|data:|vbscript:)[^'">\\s]*\\2/gi, '$1=$2$2');
  html = html.replace(/<img([^>]*)>/gi, (_m, attrs) => {
    const src = attrs.match(/\\ssrc\\s*=\\s*(['"])(.*?)\\1/i)?.[2] || '';
    const alt = attrs.match(/\\salt\\s*=\\s*(['"])(.*?)\\1/i)?.[2] || '';
    if (!isSafePublicUrl(src)) return '';
    return '<img src="' + src.replace(/"/g, '&quot;') + '" alt="' + alt.replace(/"/g, '&quot;').slice(0, 300) + '" loading="lazy" />';
  });
  html = html.replace(/<a([^>]*)href\\s*=\\s*(['"])(.*?)\\2([^>]*)>/gi, (_m, before, _q, href, after) => {
    try {
      const url = new URL(href);
      if (!['http:', 'https:'].includes(url.protocol) || isPrivateSourceHost(url.hostname)) return '<a>';
      return '<a' + before + ' href="' + url.toString().replace(/"/g, '&quot;') + '" target="_blank" rel="noopener noreferrer nofollow"' + after + '>';
    } catch {
      return '<a>';
    }
  });
  html = html.replace(/<figcaption([^>]*)>([\\s\\S]*?)<\\/figcaption>/gi, '<figcaption>$2</figcaption>');
  html = html.replace(/<([!?]?(?!\\/?(?:p|br|strong|b|em|i|u|s|h2|h3|blockquote|ul|ol|li|a|img|figure|figcaption|pre|code)(?:\\s|>|\\/)))[^>]*>/gi, '');
  return html.slice(0, maxLength);
}

function sanitizeTopics(value: unknown): string[] {
  const raw = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : [];
  const reserved = new Set([
    'news', 'analysis', 'press_release', 'ekonomi', 'bisnis', 'umkm',
    'teknologi', 'keuangan', 'regulasi', 'industri', 'daerah',
  ]);
  const result: string[] = [];
  for (const entry of raw) {
    const topic = readString(entry).toLowerCase().replace(/\s+/g, ' ');
    if (!topic || topic.length > 36 || reserved.has(topic)) continue;
    if (!/^[\p{L}\p{N}][\p{L}\p{N}\s._-]*$/u.test(topic)) continue;
    if (!result.includes(topic)) result.push(topic);
    if (result.length >= 8) break;
  }
  return result;
}

function sanitizeSources(value: unknown): string[] {
  const raw = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/\r?\n/)
      : [];
  const result: string[] = [];
  const seen = new Set<string>();
  for (const entry of raw) {
    const source = readString(entry);
    if (!source || source.length > 2048 || seen.has(source)) continue;
    try {
      const parsed = new URL(source);
      if (
        !['http:', 'https:'].includes(parsed.protocol) ||
        parsed.username ||
        parsed.password ||
        isPrivateSourceHost(parsed.hostname)
      ) {
        continue;
      }
      const normalized = parsed.toString();
      if (seen.has(normalized)) continue;
      seen.add(normalized);
      result.push(normalized);
      if (result.length >= 10) break;
    } catch {
      continue;
    }
  }
  return result;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.res;

  const rate = await enforceRateLimit({
    key: `news:revise:user:${auth.ctx.userId}`,
    limit: 30,
    windowSeconds: 3600,
  });
  if (!rate.ok) return rate.response;

  const parsed = await parseJsonBody(request);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data as Record<string, unknown>;
  const title = body.title === undefined ? undefined : readString(body.title);
  const summary = body.summary === undefined ? undefined : readString(body.summary);
  const articleBody = body.body === undefined ? undefined : readString(body.body);
  const richBodyRaw = body.rich_body === undefined ? undefined : readString(body.rich_body);
  const richBody = richBodyRaw === undefined ? undefined : sanitizeRichText(richBodyRaw, 60_000);
  const coverImage = body.cover_image === undefined ? undefined : readString(body.cover_image);
  const category = body.category === undefined ? undefined : readString(body.category);
  const kind = body.article_kind === undefined ? undefined : readString(body.article_kind);
  const location = body.location === undefined ? undefined : readString(body.location);
  const sources = body.source_urls === undefined ? undefined : sanitizeSources(body.source_urls);
  const topics = body.topics === undefined ? undefined : sanitizeTopics(body.topics);

  if (title !== undefined && (title.length < 10 || title.length > 180)) {
    return NextResponse.json({ error: 'Judul harus 10-180 karakter.' }, { status: 422 });
  }
  if (summary !== undefined && (summary.length < 20 || summary.length > 1000)) {
    return NextResponse.json({ error: 'Ringkasan harus 20-1000 karakter.' }, { status: 422 });
  }
  if (articleBody !== undefined && (articleBody.length < 120 || articleBody.length > 20_000)) {
    return NextResponse.json({ error: 'Isi berita harus 120-20.000 karakter.' }, { status: 422 });
  }
  if (richBody !== undefined && !richBody.trim()) {
    return NextResponse.json({ error: 'Format isi berita tidak boleh kosong.' }, { status: 422 });
  }
  if (richBody !== undefined && richBody.length > 60_000) {
    return NextResponse.json({ error: 'Format isi berita terlalu panjang.' }, { status: 422 });
  }
  if (coverImage !== undefined && coverImage && !isSafePublicUrl(coverImage)) {
    return NextResponse.json({ error: 'URL gambar sampul tidak valid.' }, { status: 422 });
  }
  if (category !== undefined && !CATEGORIES.has(category)) {
    return NextResponse.json({ error: 'Kategori berita tidak didukung.' }, { status: 422 });
  }
  if (kind !== undefined && !ARTICLE_KINDS.has(kind)) {
    return NextResponse.json({ error: 'Jenis konten tidak didukung.' }, { status: 422 });
  }
  if (location !== undefined && location.length > 120) {
    return NextResponse.json({ error: 'Lokasi terlalu panjang.' }, { status: 422 });
  }
  if (
    sources !== undefined &&
    kind !== undefined &&
    kind !== 'press_release' &&
    sources.length === 0
  ) {
    return NextResponse.json(
      { error: 'Berita dan analisis membutuhkan minimal satu URL sumber.' },
      { status: 422 },
    );
  }

  const safetyChecks = [
    title === undefined ? null : sanitizeText(title, 180),
    summary === undefined ? null : sanitizeText(summary, 1000),
    articleBody === undefined ? null : sanitizeText(articleBody, 20_000),
    richBody === undefined ? null : sanitizeText(richBody.replace(/<[^>]*>/g, ' '), 20_000),
  ].filter((value): value is ReturnType<typeof sanitizeText> => value !== null);
  const violations = safetyChecks.flatMap(result =>
    result.ok ? [] : result.violations.map(item => item.code),
  );
  if (violations.length > 0) {
    return NextResponse.json(
      {
        error: 'Revisi belum dapat diterima karena pemeriksaan keamanan konten.',
        violations,
      },
      { status: 422 },
    );
  }

  const { id } = await params;
  try {
    const upstream = await fetch(
      `${MARKETPLACE_URL}/v1/news/submissions/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${auth.ctx.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          summary,
          body: articleBody,
          rich_body: richBody,
          cover_image: coverImage,
          category,
          article_kind: kind,
          location,
          topics,
          source_urls: sources,
        }),
        cache: 'no-store',
      },
    );
    const text = await upstream.text();
    return new NextResponse(text, {
      status: upstream.status,
      headers: { 'Content-Type': upstream.headers.get('content-type') || 'application/json' },
    });
  } catch {
    return NextResponse.json({ error: 'Marketplace service unavailable' }, { status: 503 });
  }
}
