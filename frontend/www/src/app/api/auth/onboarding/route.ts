import { NextRequest, NextResponse } from 'next/server';
import { authSecurityHeaders, enforceAuthRouteSecurity } from '@/lib/authSecurity';
import { parseJsonBodyWithSchema } from '@/lib/serverRequest';
import { z } from 'zod';

const API_URL = process.env.INTERNAL_API_URL || 'http://localhost:8080';
const OnboardingSchema = z
  .object({
    step: z.string().min(1).optional(),
    profile: z.record(z.string(), z.unknown()).optional(),
    buyer_profile: z.record(z.string(), z.unknown()).optional(),
    provider_profile: z.record(z.string(), z.unknown()).optional(),
    freelancer_profile: z.record(z.string(), z.unknown()).optional(),
    media: z.record(z.string(), z.unknown()).optional(),
    roles: z.array(z.string().min(1)).max(16).optional(),
    image_urls: z.array(z.string().min(1)).max(40).optional(),
    document_urls: z.array(z.string().min(1)).max(24).optional(),
  })
  .passthrough();

export async function PUT(req: NextRequest) {
  try {
    const security = await enforceAuthRouteSecurity(req, {
      routeKey: 'onboarding',
      ipLimit: 300,
      deviceLimit: 200,
      windowSeconds: 3600,
    });
    if (!security.ok) return security.response;

    const token =
      req.headers.get('authorization')?.replace('Bearer ', '') ||
      req.cookies.get('access_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const parsed = await parseJsonBodyWithSchema(req, OnboardingSchema);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;

    const res = await fetch(`${API_URL}/users/me`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...authSecurityHeaders(security),
      },
      body: JSON.stringify({
        onboarding_step: body.step,
        profile: body.profile,
        buyer_profile: body.buyer_profile,
        provider_profile: body.provider_profile,
        freelancer_profile: body.freelancer_profile,
        media: body.media,
        roles: body.roles,
        image_urls: body.image_urls,
        document_urls: body.document_urls,
      }),
    });

    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error('[ONBOARDING_ERROR]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
