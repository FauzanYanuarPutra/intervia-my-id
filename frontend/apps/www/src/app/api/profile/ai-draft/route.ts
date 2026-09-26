import { NextRequest, NextResponse } from 'next/server';

import { enforceRateLimit, getClientIp } from '@/lib/rateLimit';
import { requireAuth } from '@/lib/serverAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const INTERNAL_AI_URL = (
  process.env.INTERNAL_AI_URL || 'http://ai_service:8080'
).trim().replace(/\/+$/, '');
const AI_SERVICE_TOKEN = (process.env.AI_SERVICE_TOKEN || '').trim();

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== 'string') return '';
  return value.replace(/\u0000/g, '').trim().slice(0, maxLength);
}

function cleanStringList(value: unknown, limit: number, itemMax = 180) {
  if (!Array.isArray(value)) return [];
  const result: string[] = [];
  const seen = new Set<string>();

  for (const item of value) {
    const text = cleanText(item, itemMax);
    const key = text.toLocaleLowerCase('id-ID');
    if (!text || seen.has(key)) continue;
    seen.add(key);
    result.push(text);
    if (result.length >= limit) break;
  }

  return result;
}

function jsonNoStore(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set('Cache-Control', 'no-store, max-age=0');
  response.headers.set('Pragma', 'no-cache');
  return response;
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.res;

  const rate = await enforceRateLimit({
    key: `rl:profile-ai-draft:${auth.ctx.userId}:${getClientIp(req.headers)}`,
    limit: 12,
    windowSeconds: 3600,
    message: 'Terlalu banyak permintaan AI Profil. Coba lagi nanti.',
  });
  if (!rate.ok) return rate.response;

  let body: Record<string, unknown>;
  try {
    const parsed = await req.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return jsonNoStore(
        { error: 'Payload tidak valid.' },
        { status: 400 },
      );
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return jsonNoStore(
      { error: 'Body request harus berupa JSON yang valid.' },
      { status: 400 },
    );
  }

  const locale = body.locale === 'en' ? 'en' : 'id';
  const profile =
    body.profile && typeof body.profile === 'object' && !Array.isArray(body.profile)
      ? body.profile
      : {};
  const listings = Array.isArray(body.listings)
    ? body.listings.slice(0, 20).map(item => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) return {};
        const row = item as Record<string, unknown>;
        return {
          title: cleanText(row.title, 180),
          type: cleanText(row.type, 60),
          category: cleanText(row.category, 120),
          summary: cleanText(row.summary, 500),
          location: cleanText(row.location, 180),
        };
      })
    : [];

  const prompt =
    locale === 'id'
      ? 'Buat draft profil Lajukan yang ringkas, natural, mudah dipercaya, dan mudah ditemukan lewat pencarian. Gunakan hanya fakta dari context. Jangan mengarang verifikasi, legalitas, sertifikat, jumlah tahun pengalaman, omzet, pelanggan, atau klaim keahlian yang tidak ada. Utamakan siapa pengguna/usaha ini, apa yang ditawarkan atau dicari, keahlian yang benar-benar terlihat dari data, lokasi, dan CTA yang masuk akal.'
      : 'Create a concise, natural, searchable Lajukan profile draft. Use only facts from context. Never invent verification, permits, certificates, years of experience, revenue, customers, or unsupported expertise claims. Prioritize identity/business, offers or needs, supported expertise, location, and a realistic CTA.';

  try {
    const response = await fetch(`${INTERNAL_AI_URL}/v1/profile/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(AI_SERVICE_TOKEN
          ? { Authorization: `Bearer ${AI_SERVICE_TOKEN}` }
          : {}),
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(110_000),
      body: JSON.stringify({
        task: 'profile_draft',
        message: prompt,
        locale,
        context: {
          profile,
          listings,
        },
        use_rag: false,
        response_mode: 'json',
        max_tokens: 1200,
      }),
    });

    const payload = (await response.json().catch(() => ({}))) as {
      status?: string;
      data?: Record<string, unknown>;
      response?: string;
      error?: string;
      warnings?: unknown;
      confidence?: number;
      request_id?: string;
    };

    if (!response.ok || payload.status === 'error') {
      console.error('[PROFILE_AI_DRAFT_FAILED]', {
        userId: auth.ctx.userId,
        status: response.status,
        error: payload.error || 'ai_service_error',
      });
      return jsonNoStore(
        {
          error:
            locale === 'id'
              ? 'AI Profil sedang tidak tersedia. Coba lagi sebentar lagi.'
              : 'Profile AI is temporarily unavailable. Please retry shortly.',
          request_id: payload.request_id || undefined,
        },
        { status: response.status >= 500 ? 502 : response.status },
      );
    }

    const data = payload.data && typeof payload.data === 'object'
      ? payload.data
      : {};

    return jsonNoStore({
      data: {
        headline: cleanText(data.headline, 180),
        bio: cleanText(data.bio, 900),
        business_name: cleanText(data.business_name, 180),
        services: cleanStringList(data.services, 12),
        expertise: cleanStringList(data.expertise, 16),
        location: cleanText(data.location, 180),
        contact_cta: cleanText(data.contact_cta, 180),
        keywords: cleanStringList(data.keywords, 20, 80),
        missing_fields: cleanStringList(data.missing_fields, 12, 180),
        trust_notes: cleanStringList(data.trust_notes, 12, 220),
        response: cleanText(payload.response, 1200),
        confidence:
          typeof payload.confidence === 'number'
            ? Math.max(0, Math.min(1, payload.confidence))
            : null,
        warnings: Array.isArray(payload.warnings)
          ? payload.warnings.filter(
              (item): item is string => typeof item === 'string',
            )
          : [],
        request_id: cleanText(payload.request_id, 128),
      },
    });
  } catch (error) {
    console.error('[PROFILE_AI_DRAFT_GATEWAY_ERROR]', {
      userId: auth.ctx.userId,
      error: error instanceof Error ? error.message : String(error),
    });
    return jsonNoStore(
      {
        error:
          locale === 'id'
            ? 'AI Profil gagal terhubung ke layanan AI.'
            : 'Profile AI could not reach the AI service.',
      },
      { status: 502 },
    );
  }
}
