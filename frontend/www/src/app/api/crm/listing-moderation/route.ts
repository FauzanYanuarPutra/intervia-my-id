import { NextRequest, NextResponse } from 'next/server';
import { getJwtSubject } from '@/lib/server/jwtPayload';

const MARKETPLACE_URL =
  process.env.INTERNAL_MARKETPLACE_URL ||
  process.env.MARKETPLACE_URL ||
  'http://localhost:8081';

type GenericRecord = Record<string, unknown>;

function asObject(value: unknown): GenericRecord {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as GenericRecord;
  }
  return {};
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export async function GET(request: NextRequest) {
  const token =
    request.headers.get('authorization')?.replace('Bearer ', '') ||
    request.cookies.get('access_token')?.value;
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ownerId = getJwtSubject(token);
  const res = await fetch(`${MARKETPLACE_URL}/v1/content?limit=200&offset=0&owner_id=${encodeURIComponent(ownerId || '')}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  const payload = await res.json().catch(() => ({}));
  const items = Array.isArray(payload)
    ? payload
    : Array.isArray((payload as GenericRecord).items)
      ? (payload as GenericRecord).items
      : Array.isArray((payload as GenericRecord).results)
        ? (payload as GenericRecord).results
        : [];

  const results = (items as GenericRecord[]).map(item => {
    const metadata = asObject(item.metadata);
    const reports = Array.isArray(metadata.listing_reports)
      ? (metadata.listing_reports as GenericRecord[])
      : [];
    const moderation = asObject(metadata.listing_moderation);
    return {
      id: asString(item.id),
      title: asString(item.title || item.name || 'Untitled listing'),
      slug: asString(item.slug),
      status: asString(item.content_status || item.status || 'draft'),
      owner_id: asString(item.owner_id),
      updated_at: asString(item.updated_at || item.created_at),
      report_count: reports.length,
      strike_count: reports.filter(report =>
        ['scam', 'illegal', 'harassment'].includes(asString(report.reason)),
      ).length,
      moderation_state: asString(moderation.state || (reports.length ? 'flagged' : 'clean')),
      last_report_at: asString(moderation.last_report_at || reports[0]?.created_at),
      last_action_at: asString(moderation.updated_at || moderation.last_action_at),
      reports: reports.slice(0, 12),
      moderation,
      reporter_summary: reports.reduce<Record<string, number>>((acc, report) => {
        const key = asString(report.reporter_name || report.reporter_email || report.reporter_id || 'Unknown');
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {}),
    };
  });

  results.sort((left, right) => {
    const leftScore = Number(Boolean(left.report_count)) * 2 + Number(Boolean(left.strike_count));
    const rightScore = Number(Boolean(right.report_count)) * 2 + Number(Boolean(right.strike_count));
    if (rightScore !== leftScore) return rightScore - leftScore;
    return Date.parse(right.last_report_at || right.updated_at || '') - Date.parse(left.last_report_at || left.updated_at || '');
  });

  return NextResponse.json({ results });
}

