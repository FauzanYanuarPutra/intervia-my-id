import { NextRequest, NextResponse } from 'next/server';
import { parseJsonBody } from '@/lib/serverRequest';
import { evaluateTrustSafety } from '@/lib/trustSafety';
import {
  canTransitionContentStatus,
  collectTrustSafetyCandidates,
  toUpsertListingPayload,
  validateListingPayload,
} from '@/lib/content/listingFlowRules';
import {
  attachOwnerProfilesToContent,
  fetchOwnerPublicProfiles,
  shouldIncludeOwnerProfiles,
} from '@/lib/content/ownerProfiles';
import { extractContentId } from '@/lib/content/routes';
import { requirePhoneVerifiedForListing } from '@/lib/server/phoneVerification';

const marketplaceBase =
  process.env.INTERNAL_MARKETPLACE_URL ||
  process.env.NEXT_PUBLIC_MARKETPLACE_URL ||
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

function normalizeStatus(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : undefined;
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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolvedParams = await params;
  const resolvedContentId = extractContentId(resolvedParams.id);

  if (!marketplaceBase) {
    return NextResponse.json(
      { error: 'Marketplace service URL not configured' },
      { status: 500 },
    );
  }

  const includeOwnerProfiles = shouldIncludeOwnerProfiles(
    new URL(req.url).searchParams,
  );

  const backendRes = await fetch(
    `${marketplaceBase}/v1/content/${resolvedContentId || resolvedParams.id}`,
    { method: 'GET', headers: { 'Content-Type': 'application/json' } },
  );

  let data = await backendRes.json().catch(() => null);
  if (
    backendRes.ok &&
    includeOwnerProfiles &&
    data &&
    typeof data === 'object' &&
    !Array.isArray(data)
  ) {
    const enriched = await fetchOwnerPublicProfiles({
      req,
      identityBase:
        process.env.INTERNAL_API_URL ||
        process.env.NEXT_PUBLIC_API_URL ||
        'http://localhost:8080',
      items: [data as Record<string, unknown>],
    });
    if (enriched.size > 0) {
      data = attachOwnerProfilesToContent(
        [data as Record<string, unknown>],
        enriched,
      )[0];
    }
  }
  return NextResponse.json(data ?? { error: 'Invalid response' }, {
    status: backendRes.status,
  });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!marketplaceBase) {
    return NextResponse.json(
      { error: 'Marketplace service URL not configured' },
      { status: 500 },
    );
  }

  const token =
    req.headers.get('authorization')?.replace('Bearer ', '') ||
    req.cookies.get('access_token')?.value;

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const parsedBody = await parseJsonBody(req);
  if (!parsedBody.ok) return parsedBody.response;
  if (!parsedBody.data || typeof parsedBody.data !== 'object') {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 },
    );
  }

  const requestedPayload = parsedBody.data as Record<string, unknown>;
  const validatedPatch = validateListingPayload(requestedPayload, {
    mode: 'update',
  });
  if (!validatedPatch.ok) {
    return NextResponse.json(
      { error: validatedPatch.error, issues: validatedPatch.issues },
      { status: 422 },
    );
  }

  const resolvedParams = await params;
  const resolvedContentId = extractContentId(resolvedParams.id);
  const existingRes = await fetch(
    `${marketplaceBase}/v1/content/${resolvedContentId || resolvedParams.id}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    },
  );
  const existingData = await existingRes.json().catch(() => null);
  if (!existingRes.ok || !existingData || typeof existingData !== 'object') {
    return NextResponse.json(
      existingData ?? { error: 'Failed to load current content state' },
      { status: existingRes.status || 502 },
    );
  }
  const currentState = existingData as Record<string, unknown>;
  const currentStatus =
    normalizeStatus(currentState.content_status) ||
    normalizeStatus(currentState.status) ||
    'draft';
  const requestedStatus = normalizeStatus(requestedPayload.content_status);

  if (
    requestedStatus &&
    !canTransitionContentStatus(currentStatus, requestedStatus)
  ) {
    return NextResponse.json(
      {
        error: 'Invalid content status transition',
        current_status: currentStatus,
        next_status: requestedStatus,
      },
      { status: 409 },
    );
  }

  const requiresStrictValidation =
    requestedStatus === 'active' && currentStatus !== 'active';
  if (requiresStrictValidation) {
    const phoneVerification = await requirePhoneVerifiedForListing(token);
    if (!phoneVerification.ok) {
      return phoneVerification.response;
    }
  }

  if (requiresStrictValidation) {
    const mergedPayload: Record<string, unknown> = {
      ...currentState,
      ...requestedPayload,
      metadata: requestedPayload.metadata ?? currentState.metadata,
    };
    const strictValidation = validateListingPayload(mergedPayload, {
      mode: 'update',
      strictActiveValidation: true,
    });
    if (!strictValidation.ok) {
      return NextResponse.json(
        { error: strictValidation.error, issues: strictValidation.issues },
        { status: 422 },
      );
    }
  }

  const forwardPayload = toUpsertListingPayload(validatedPatch.payload);
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

  const backendRes = await fetch(
    `${marketplaceBase}/v1/content/${resolvedContentId || resolvedParams.id}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(
        toUpsertListingPayload(
          normalizeContentMediaUrls(forwardPayload, req.nextUrl.origin),
        ),
      ),
    },
  );

  const data = await readUpstreamPayload(backendRes);
  return NextResponse.json(data ?? { error: 'Invalid response' }, {
    status: backendRes.status,
  });
}
