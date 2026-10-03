import { NextRequest, NextResponse } from 'next/server';

import { enforceRateLimit, getClientIp } from '@/lib/rateLimit';
import { requireAuth } from '@/lib/serverAuth';
import { extractContentId } from '@/lib/content/routes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 5;

const INTERNAL_AI_URL = (
  process.env.INTERNAL_AI_URL || 'http://ai_service:8080'
).trim().replace(/\/+$/, '');
const MARKETPLACE_URL =
  process.env.INTERNAL_MARKETPLACE_URL ||
  process.env.NEXT_PUBLIC_MARKETPLACE_URL ||
  'http://localhost:8081';
const AI_SERVICE_TOKEN = (process.env.AI_SERVICE_TOKEN || '').trim();

function text(value: unknown, max = 500) {
  if (typeof value !== 'string') return '';
  return value.replace(/\u0000/g, '').trim().slice(0, max);
}

function list(value: unknown, limit: number, max = 180): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map(item => text(item, max))
    .filter(Boolean)
    .slice(0, limit);
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function cleanCandidate(value: unknown) {
  const item = record(value);
  return {
    id: text(item.id, 120),
    title: text(item.title, 180),
    summary: text(item.summary, 450),
    content_type: text(item.content_type, 60),
    price_cents:
      typeof item.price_cents === 'number' && Number.isFinite(item.price_cents)
        ? Math.max(0, Math.round(item.price_cents))
        : null,
    currency: text(item.currency, 12) || 'IDR',
    city: text(item.city, 100),
    distance_km:
      typeof item.distance_km === 'number' && Number.isFinite(item.distance_km)
        ? Math.max(0, Math.round(item.distance_km * 10) / 10)
        : null,
    budget_min:
      typeof item.budget_min === 'number' && Number.isFinite(item.budget_min)
        ? Math.max(0, Math.round(item.budget_min))
        : null,
    budget_max:
      typeof item.budget_max === 'number' && Number.isFinite(item.budget_max)
        ? Math.max(0, Math.round(item.budget_max))
        : null,
    similarity_score:
      typeof item.similarity_score === 'number' && Number.isFinite(item.similarity_score)
        ? Math.max(0, Math.min(100, Math.round(item.similarity_score)))
        : null,
    worth_score:
      typeof item.worth_score === 'number' && Number.isFinite(item.worth_score)
        ? Math.max(0, Math.min(100, Math.round(item.worth_score)))
        : null,
    reasons: list(item.reasons, 3, 220),
    warnings: list(item.warnings, 2, 220),
    rating:
      typeof item.rating === 'number' && Number.isFinite(item.rating)
        ? Math.max(0, Math.min(5, item.rating))
        : null,
    review_count:
      typeof item.review_count === 'number' && Number.isFinite(item.review_count)
        ? Math.max(0, Math.round(item.review_count))
        : null,
  };
}

function noStore(body: unknown, status = 200) {
  const response = NextResponse.json(body, { status });
  response.headers.set('Cache-Control', 'no-store, max-age=0');
  response.headers.set('Pragma', 'no-cache');
  return response;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.res;

  const rate = await enforceRateLimit({
    key: `rl:content-match-ai:${auth.ctx.userId}:${getClientIp(req.headers)}`,
    limit: 30,
    windowSeconds: 3600,
    message: 'Terlalu banyak permintaan Match AI. Coba lagi nanti.',
  });
  if (!rate.ok) return rate.response;

  let body: Record<string, unknown>;
  try {
    const parsed = await req.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return noStore({ error: 'Payload tidak valid.' }, 400);
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return noStore({ error: 'Body request harus JSON valid.' }, 400);
  }

  const { id } = await params;
  const resolvedId = extractContentId(id) || id;

  const source = record(body.source);
  const sourceId = text(source.id, 120);
  if (!sourceId || sourceId !== resolvedId) {
    return noStore(
      { error: 'Source content tidak sesuai dengan URL match.' },
      400,
    );
  }

  const candidates = (Array.isArray(body.candidates) ? body.candidates : [])
    .map(cleanCandidate)
    .filter(candidate => candidate.id)
    .slice(0, 8);

  if (candidates.length < 2) {
    return noStore(
      { error: 'Source dan minimal dua kandidat diperlukan.' },
      400,
    );
  }

  const candidateIds = new Set(candidates.map(candidate => candidate.id));

  let feedbackHistory: Array<{
    matched_content_id: string;
    feedback_type: 'approved' | 'rejected';
    candidate_snapshot: Record<string, unknown>;
    note: string;
    created_at: string;
  }> = [];

  try {
    const feedbackResponse = await fetch(
      `${MARKETPLACE_URL}/v1/content/${encodeURIComponent(resolvedId)}/matches/feedback`,
      {
        headers: {
          Authorization: `Bearer ${auth.ctx.token}`,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
        signal: AbortSignal.timeout(900),
      },
    ).catch(() => null);

    if (feedbackResponse?.ok) {
      const feedbackPayload = (await feedbackResponse.json().catch(() => ({}))) as {
        feedback?: unknown;
      };
      feedbackHistory = Array.isArray(feedbackPayload.feedback)
        ? feedbackPayload.feedback
            .map(item => {
              const value = record(item);
              const type = text(value.feedback_type, 32);
              const snapshot = record(value.candidate_snapshot);
              return {
                matched_content_id: text(value.matched_content_id, 120),
                feedback_type:
                  type === 'approved' ? 'approved' : type === 'rejected' ? 'rejected' : null,
                candidate_snapshot: {
                  id: text(snapshot.id, 120),
                  title: text(snapshot.title, 180),
                  summary: text(snapshot.summary, 400),
                  content_type: text(snapshot.content_type, 60),
                  category: text(snapshot.category, 120),
                  city: text(snapshot.city, 100),
                  tags: list(snapshot.tags, 12, 80),
                },
                note: text(value.note, 300),
                created_at: text(value.created_at, 80),
              };
            })
            .filter(
              (
                item,
              ): item is {
                matched_content_id: string;
                feedback_type: 'approved' | 'rejected';
                candidate_snapshot: Record<string, unknown>;
                note: string;
                created_at: string;
              } => Boolean(item.matched_content_id && item.feedback_type),
            )
            .slice(0, 50)
        : [];
    }
  } catch {}

  try {
    const response = await fetch(`${INTERNAL_AI_URL}/v1/match/similar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(AI_SERVICE_TOKEN
          ? { Authorization: `Bearer ${AI_SERVICE_TOKEN}` }
          : {}),
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(1800),
      body: JSON.stringify({
        task: 'similar_match',
        locale: body.locale === 'en' ? 'en' : 'id',
        message:
          body.locale === 'en'
            ? 'Rank the supplied candidates for this listing. Use only the candidate IDs supplied in context. Learn from feedback_history: approved means the user found that kind of match useful; rejected means downrank that candidate and similar patterns when evidence supports it.'
            : 'Urutkan kandidat yang sudah diberikan untuk listing ini. Gunakan hanya ID kandidat yang ada di context. Pelajari feedback_history: approved berarti pengguna menilai match seperti itu berguna; rejected berarti turunkan kandidat itu dan pola serupa bila buktinya mendukung.',
        context: {
          source: {
            id: text(source.id, 120),
            title: text(source.title, 180),
            summary: text(source.summary, 700),
            body: text(source.body, 1600),
            category: text(source.category, 120),
            content_type: text(source.content_type, 60),
            price_cents:
              typeof source.price_cents === 'number' && Number.isFinite(source.price_cents)
                ? Math.max(0, Math.round(source.price_cents))
                : null,
            price_unit: text(source.price_unit, 80),
            city: text(source.city, 100),
          },
          candidates,
          feedback_history: feedbackHistory,
        },
        use_rag: false,
        response_mode: 'json',
        max_tokens: 650,
      }),
    });

    const payload = (await response.json().catch(() => ({}))) as {
      status?: string;
      data?: {
        ranked_candidate_ids?: unknown;
        assessments?: unknown;
      };
      request_id?: string;
      confidence?: number;
    };

    if (!response.ok || payload.status === 'error') {
      return noStore(
        {
          available: false,
          request_id: text(payload.request_id, 120),
        },
        200,
      );
    }

    const ranked = list(payload.data?.ranked_candidate_ids, 8, 120).filter(id =>
      candidateIds.has(id),
    );

    const assessments = Array.isArray(payload.data?.assessments)
      ? payload.data.assessments
          .map(item => {
            const value = record(item);
            const id = text(value.id, 120);
            return {
              id,
              similarity:
                typeof value.similarity === 'number' && Number.isFinite(value.similarity)
                  ? Math.max(0, Math.min(100, Math.round(value.similarity)))
                  : null,
              fit:
                typeof value.fit === 'number' && Number.isFinite(value.fit)
                  ? Math.max(0, Math.min(100, Math.round(value.fit)))
                  : null,
              worth_it:
                typeof value.worth_it === 'number' && Number.isFinite(value.worth_it)
                  ? Math.max(0, Math.min(100, Math.round(value.worth_it)))
                  : null,
              reason: text(value.reason, 240),
              caution: text(value.caution, 240),
            };
          })
          .filter(item => candidateIds.has(item.id))
          .slice(0, 8)
      : [];

    return noStore({
      available: ranked.length >= 2,
      ranked_candidate_ids: ranked,
      assessments,
      confidence:
        typeof payload.confidence === 'number'
          ? Math.max(0, Math.min(1, payload.confidence))
          : null,
      request_id: text(payload.request_id, 120),
    });
  } catch (error) {
    console.warn('[CONTENT_MATCH_AI_RERANK_UNAVAILABLE]', {
      userId: auth.ctx.userId,
      error: error instanceof Error ? error.message : String(error),
    });
    return noStore({ available: false }, 200);
  }
}
