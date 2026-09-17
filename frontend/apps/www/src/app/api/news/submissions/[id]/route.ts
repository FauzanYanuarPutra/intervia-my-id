import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/serverAuth';
import { parseJsonBody } from '@/lib/serverRequest';
import { enforceRateLimit } from '@/lib/rateLimit';

const MARKETPLACE_URL = (
  process.env.INTERNAL_MARKETPLACE_URL ||
  process.env.MARKETPLACE_URL ||
  'http://localhost:8081'
).replace(/\/+$/, '');

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
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
  if (!Array.isArray(value)) return [];
  const result: string[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    const source = readString(entry);
    if (!source || seen.has(source)) continue;
    try {
      const parsed = new URL(source);
      if (!['http:', 'https:'].includes(parsed.protocol)) continue;
      seen.add(source);
      result.push(source);
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
  const sources = body.source_urls === undefined ? undefined : sanitizeSources(body.source_urls);
  const topics = body.topics === undefined ? undefined : sanitizeTopics(body.topics);
  const kind = readString(body.article_kind);
  if (sources !== undefined && kind !== 'press_release' && sources.length === 0) {
    return NextResponse.json(
      { error: 'Berita dan analisis membutuhkan minimal satu URL sumber.' },
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
          title: body.title,
          summary: body.summary,
          body: body.body,
          category: body.category,
          article_kind: body.article_kind,
          location: body.location,
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
