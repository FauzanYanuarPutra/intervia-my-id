import { NextRequest, NextResponse } from 'next/server';
import { normalizeSafeExternalHttpUrl } from 'lajukan-ui';
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

function sanitizeText(value: string, maxLength: number) {
  return evaluateTrustSafety(value, {
    maxLength,
    allowExternalLinks: false,
    enforceOffPlatformPayment: false,
  });
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
    const normalized = normalizeSafeExternalHttpUrl(source);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
    if (result.length >= 10) break; catch {
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
