import { NextRequest, NextResponse } from 'next/server';
import { normalizeSafeExternalHttpUrl } from 'lajukan-ui';
import { enforceRateLimit, getClientIp } from '@/lib/rateLimit';
import { requireAuth } from '@/lib/serverAuth';
import { parseJsonBody } from '@/lib/serverRequest';
import { evaluateTrustSafety } from '@/lib/trustSafety';

const MARKETPLACE_URL = (
  process.env.INTERNAL_MARKETPLACE_URL ||
  process.env.MARKETPLACE_URL ||
  'http://localhost:8081'
).replace(/\/+$/, '');

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

type SubmissionBody = {
  title?: unknown;
  summary?: unknown;
  body?: unknown;
  category?: unknown;
  article_kind?: unknown;
  language?: unknown;
  location?: unknown;
  topics?: unknown;
  source_urls?: unknown;
};

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function readTopics(value: unknown): string[] {
  const raw = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : [];
  const reserved = new Set([
    'news', 'analysis', 'press_release', 'ekonomi', 'bisnis', 'umkm',
    'teknologi', 'keuangan', 'regulasi', 'industri', 'daerah',
  ]);
  const topics: string[] = [];
  for (const entry of raw) {
    const topic = readString(entry).toLowerCase().replace(/\s+/g, ' ');
    if (!topic || topic.length > 36 || reserved.has(topic)) continue;
    if (!/^[\p{L}\p{N}][\p{L}\p{N}\s._-]*$/u.test(topic)) continue;
    if (!topics.includes(topic)) topics.push(topic);
    if (topics.length >= 8) break;
  }
  return topics;
}

function readSources(value: unknown): string[] {
  const raw = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/\r?\n/)
      : [];
  const seen = new Set<string>();
  const sources: string[] = [];
  for (const entry of raw) {
    const source = readString(entry);
    const normalized = normalizeSafeExternalHttpUrl(source);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    sources.push(normalized);
    if (sources.length >= 10) break;
  }
  return sources;
}

function sanitizeText(value: string, maxLength: number) {
  return evaluateTrustSafety(value, {
    maxLength,
    allowExternalLinks: false,
    enforceOffPlatformPayment: false,
  });
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.res;

  const limit = await enforceRateLimit({
    key: `news:mine:user:${auth.ctx.userId}`,
    limit: 120,
    windowSeconds: 3600,
  });
  if (!limit.ok) return limit.response;

  try {
    const upstream = await fetch(`${MARKETPLACE_URL}/v1/news/submissions/mine`, {
      headers: { Authorization: `Bearer ${auth.ctx.token}` },
      cache: 'no-store',
    });
    const text = await upstream.text();
    return new NextResponse(text, {
      status: upstream.status,
      headers: { 'Content-Type': upstream.headers.get('content-type') || 'application/json' },
    });
  } catch {
    return NextResponse.json({ error: 'Marketplace service unavailable' }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.res;

  const ipLimit = await enforceRateLimit({
    key: `news:submit:ip:${getClientIp(request)}`,
    limit: 20,
    windowSeconds: 3600,
  });
  if (!ipLimit.ok) return ipLimit.response;

  const userLimit = await enforceRateLimit({
    key: `news:submit:user:${auth.ctx.userId}`,
    limit: 10,
    windowSeconds: 3600,
  });
  if (!userLimit.ok) return userLimit.response;

  const parsed = await parseJsonBody(request);
  if (!parsed.ok) return parsed.response;
  const payload = parsed.data as SubmissionBody;

  const rawTitle = readString(payload.title);
  const rawSummary = readString(payload.summary);
  const rawBody = readString(payload.body);
  const category = readString(payload.category) || 'Ekonomi';
  const articleKind = readString(payload.article_kind) || 'news';
  const language = readString(payload.language) || 'id';
  const location = readString(payload.location);
  const topics = readTopics(payload.topics);
  const sourceUrls = readSources(payload.source_urls);

  if (rawTitle.length < 10 || rawTitle.length > 180) {
    return NextResponse.json({ error: 'Judul harus 10-180 karakter.' }, { status: 422 });
  }
  if (rawSummary.length < 20 || rawSummary.length > 1000) {
    return NextResponse.json({ error: 'Ringkasan harus 20-1000 karakter.' }, { status: 422 });
  }
  if (rawBody.length < 120 || rawBody.length > 20_000) {
    return NextResponse.json({ error: 'Isi berita harus 120-20.000 karakter.' }, { status: 422 });
  }
  if (!CATEGORIES.has(category)) {
    return NextResponse.json({ error: 'Kategori berita tidak didukung.' }, { status: 422 });
  }
  if (!ARTICLE_KINDS.has(articleKind)) {
    return NextResponse.json({ error: 'Jenis konten tidak didukung.' }, { status: 422 });
  }
  if (!['id', 'en'].includes(language)) {
    return NextResponse.json({ error: 'Bahasa berita tidak didukung.' }, { status: 422 });
  }
  if (location.length > 120) {
    return NextResponse.json({ error: 'Lokasi terlalu panjang.' }, { status: 422 });
  }
  if (sourceUrls.length === 0 && articleKind !== 'press_release') {
    return NextResponse.json(
      { error: 'Berita dan analisis membutuhkan minimal satu URL sumber.' },
      { status: 422 },
    );
  }

  const titleSafety = sanitizeText(rawTitle, 180);
  const summarySafety = sanitizeText(rawSummary, 1000);
  const bodySafety = sanitizeText(rawBody, 20_000);
  if (!titleSafety.ok || !summarySafety.ok || !bodySafety.ok) {
    return NextResponse.json(
      {
        error: 'Kiriman belum dapat diterima karena pemeriksaan keamanan konten.',
        violations: [
          ...(!titleSafety.ok ? titleSafety.violations.map(item => item.code) : []),
          ...(!summarySafety.ok ? summarySafety.violations.map(item => item.code) : []),
          ...(!bodySafety.ok ? bodySafety.violations.map(item => item.code) : []),
        ],
      },
      { status: 422 },
    );
  }

  const submittedAt = new Date().toISOString();
  const upstream = await fetch(`${MARKETPLACE_URL}/v1/content`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${auth.ctx.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      content_type: 'news',
      title: titleSafety.sanitizedText,
      summary: summarySafety.sanitizedText,
      body: bodySafety.sanitizedText,
      content_status: 'draft',
      tags: ['news', category.toLowerCase(), articleKind, ...topics],
      metadata: {
        news: {
          category,
          article_kind: articleKind,
          language,
          location: location || null,
          source_urls: sourceUrls,
          submitted_at: submittedAt,
          editorial_status: 'pending_review',
          contributor_id: auth.ctx.userId,
          disclosure:
            articleKind === 'press_release'
              ? 'Submitted by a business or its representative; editorially reviewed before publication.'
              : null,
        },
      },
    }),
    cache: 'no-store',
  });

  const text = await upstream.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { error: text || 'Invalid upstream response' };
  }

  if (!upstream.ok) {
    return NextResponse.json(data ?? { error: 'Gagal mengirim berita.' }, {
      status: upstream.status,
    });
  }

  return NextResponse.json(
    {
      data,
      editorial_status: 'pending_review',
      message: 'Kiriman diterima dan menunggu review editorial.',
    },
    { status: 201 },
  );
}
