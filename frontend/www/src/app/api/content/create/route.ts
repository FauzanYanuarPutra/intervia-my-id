import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/serverAuth';
import { enforceRateLimit, getClientIp } from '@/lib/rateLimit';
import { evaluateTrustSafety } from '@/lib/trustSafety';
import { parseJsonBody } from '@/lib/serverRequest';
import {
  collectTrustSafetyCandidates,
  toUpsertListingPayload,
  validateListingPayload,
} from '@/lib/content/listingFlowRules';
import { requirePhoneVerifiedForListing } from '@/lib/server/phoneVerification';

const MARKETPLACE_URL =
  process.env.INTERNAL_MARKETPLACE_URL ||
  process.env.MARKETPLACE_URL ||
  'http://localhost:8081';

function setNestedString(
  target: Record<string, unknown>,
  path: string,
  value: string,
) {
  const segments = path.split('.').filter(Boolean);
  if (segments.length === 0) return;
  let cursor: Record<string, unknown> = target;
  for (let i = 0; i < segments.length - 1; i += 1) {
    const key = segments[i];
    const current = cursor[key];
    if (!current || typeof current !== 'object' || Array.isArray(current)) {
      const next: Record<string, unknown> = {};
      cursor[key] = next;
      cursor = next;
      continue;
    }
    cursor = current as Record<string, unknown>;
  }
  cursor[segments[segments.length - 1]] = value;
}

async function readUpstreamPayload(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { error: text.trim() || 'Upstream request failed' };
  }
}

function absolutizeIfRelativeUrl(value: string, origin: string): string {
  const trimmed = value.trim();
  if (
    trimmed.startsWith('/api/content/media/') ||
    trimmed.startsWith('/uploads/')
  ) {
    return trimmed;
  }
  if (!trimmed.startsWith('/')) return trimmed;
  try {
    return new URL(trimmed, origin).toString();
  } catch {
    return trimmed;
  }
}

function normalizeContentMediaUrls(
  payload: Record<string, unknown>,
  origin: string,
): Record<string, unknown> {
  const normalized = { ...payload };
  if (typeof normalized.cover_image === 'string') {
    normalized.cover_image = absolutizeIfRelativeUrl(
      normalized.cover_image,
      origin,
    );
  }

  if (
    !normalized.metadata ||
    typeof normalized.metadata !== 'object' ||
    Array.isArray(normalized.metadata)
  ) {
    return normalized;
  }

  const metadata = {
    ...(normalized.metadata as Record<string, unknown>),
  };

  for (const key of ['cover_image', 'image', 'thumbnail']) {
    if (typeof metadata[key] === 'string') {
      metadata[key] = absolutizeIfRelativeUrl(metadata[key] as string, origin);
    }
  }

  for (const key of ['images', 'image_urls', 'gallery', 'gallery_images']) {
    if (Array.isArray(metadata[key])) {
      metadata[key] = metadata[key].map(entry =>
        typeof entry === 'string'
          ? absolutizeIfRelativeUrl(entry, origin)
          : entry,
      );
    }
  }

  if (Array.isArray(metadata.documents)) {
    metadata.documents = metadata.documents.map(entry => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry))
        return entry;
      const record = { ...(entry as Record<string, unknown>) };
      if (typeof record.url === 'string') {
        record.url = absolutizeIfRelativeUrl(record.url, origin);
      }
      return record;
    });
  }

  normalized.metadata = metadata;
  return normalized;
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.res;

    const phoneVerification = await requirePhoneVerifiedForListing(
      auth.ctx.token,
    );
    if (!phoneVerification.ok) return phoneVerification.response;

    const ip = getClientIp(req);
    const ipRateLimit = await enforceRateLimit({
      key: `content:create:ip:${ip}`,
      limit: 80,
      windowSeconds: 3600,
    });
    if (!ipRateLimit.ok) return ipRateLimit.response;

    const userRateLimit = await enforceRateLimit({
      key: `content:create:user:${auth.ctx.userId}`,
      limit: 40,
      windowSeconds: 3600,
    });
    if (!userRateLimit.ok) return userRateLimit.response;

    const parsedBody = await parseJsonBody(req);
    if (!parsedBody.ok) return parsedBody.response;

    const validated = validateListingPayload(parsedBody.data, {
      mode: 'create',
    });
    if (!validated.ok) {
      return NextResponse.json(
        { error: validated.error, issues: validated.issues },
        { status: 422 },
      );
    }

    const forwardPayload = toUpsertListingPayload(validated.payload);
    const trustSafetyCandidates = collectTrustSafetyCandidates(forwardPayload);
    for (const candidate of trustSafetyCandidates) {
      const safety = evaluateTrustSafety(candidate.value, {
        maxLength: candidate.maxLength,
        allowExternalLinks: false,
        enforceOffPlatformPayment: true,
      });
      if (!safety.ok) {
        return NextResponse.json(
          {
            error: `Content field "${candidate.field}" blocked by trust safety policy`,
            violations: safety.violations.map(item => item.code),
          },
          { status: 422 },
        );
      }
      setNestedString(forwardPayload, candidate.field, safety.sanitizedText);
    }

    const res = await fetch(`${MARKETPLACE_URL}/v1/content`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${auth.ctx.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(
        toUpsertListingPayload(
          normalizeContentMediaUrls(forwardPayload, req.nextUrl.origin),
        ),
      ),
    });

    const data = await readUpstreamPayload(res);
    if (!res.ok) {
      console.error('[CREATE_CONTENT_ERROR]', res.status, data);
    }
    return NextResponse.json(data ?? { error: 'Invalid response' }, {
      status: res.status,
    });
  } catch (error) {
    console.error('[CREATE_CONTENT_ERROR]', error);
    const message =
      error instanceof Error && 'cause' in error
        ? String((error as Error & { cause?: unknown }).cause)
        : null;
    return NextResponse.json(
      {
        error: 'Internal server error',
        ...(message && { details: message }),
      },
      { status: 500 },
    );
  }
}
