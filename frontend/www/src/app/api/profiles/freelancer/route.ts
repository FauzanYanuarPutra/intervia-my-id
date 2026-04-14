import { NextRequest, NextResponse } from 'next/server';

const MARKETPLACE_URL =
  process.env.INTERNAL_MARKETPLACE_URL ||
  process.env.MARKETPLACE_URL ||
  'http://localhost:8081';

function getToken(req: NextRequest): string | null {
  return (
    req.headers.get('authorization')?.replace('Bearer ', '') ||
    req.cookies.get('access_token')?.value ||
    null
  );
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function normalizeFreelancerPayload(body: Record<string, unknown>) {
  const hourlyRate = toNumber(body.hourly_rate);
  const title =
    (typeof body.professional_title === 'string' && body.professional_title.trim()) ||
    (typeof body.tagline === 'string' && body.tagline.trim()) ||
    'Freelancer Profile';
  const summary =
    (typeof body.bio === 'string' && body.bio.trim()) ||
    (typeof body.tagline === 'string' && body.tagline.trim()) ||
    '';
  const metadata = { ...body };

  return {
    content_type: 'freelancer',
    category: 'freelancer',
    title,
    summary,
    body: summary,
    price_cents: hourlyRate != null ? Math.max(0, Math.round(hourlyRate * 100)) : undefined,
    metadata,
  };
}

export async function POST(request: NextRequest) {
  try {
    const token = getToken(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const requiredFields = ['tagline', 'professional_title', 'hourly_rate', 'skills', 'bio'];
    const missing = requiredFields.filter((field) => !body[field]);
    if (missing.length) {
      return NextResponse.json(
        { error: `Missing required fields: ${missing.join(', ')}` },
        { status: 400 },
      );
    }

    const payload = normalizeFreelancerPayload(body);
    const response = await fetch(`${MARKETPLACE_URL}/v1/content`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('[FREELANCER_PROFILE_CREATE_ERROR]', error);
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const token = getToken(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const profileId =
      (typeof body.id === 'string' && body.id.trim()) ||
      (typeof body.profile_id === 'string' && body.profile_id.trim());

    if (!profileId) {
      return NextResponse.json(
        { error: 'profile_id (or id) is required for update' },
        { status: 400 },
      );
    }

    const payload = normalizeFreelancerPayload(body);
    const response = await fetch(`${MARKETPLACE_URL}/v1/content/${encodeURIComponent(profileId)}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('[FREELANCER_PROFILE_UPDATE_ERROR]', error);
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }
}

