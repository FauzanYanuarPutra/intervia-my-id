import { NextRequest, NextResponse } from 'next/server';
import {
  authSecurityHeaders,
  enforceAuthRouteSecurity,
} from '@/lib/authSecurity';
import { normalizeProfilePayloadMedia } from '@/lib/profile/profileMedia';
import { enforceRateLimit } from '@/lib/rateLimit';
import { parseJsonBodyWithSchema } from '@/lib/serverRequest';
import { z } from 'zod';

const API_URL = process.env.INTERNAL_API_URL || 'http://localhost:8080';

function getCommunityApiUrl(): string | null {
  const configured =
    process.env.COMMUNITY_SERVICE_URL ||
    process.env.INTERNAL_COMMUNITY_URL ||
    '';
  if (configured.trim()) return configured.trim().replace(/\/$/, '');
  return process.env.NODE_ENV === 'development'
    ? 'http://127.0.0.1:8082'
    : null;
}

async function syncCommunityProfile(token: string): Promise<void> {
  const communityApiUrl = getCommunityApiUrl();
  if (!communityApiUrl) return;

  try {
    const response = await fetch(
      `${communityApiUrl}/v1/community/profile/sync`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
        signal: AbortSignal.timeout(2500),
      },
    );
    if (!response.ok) {
      console.warn('[COMMUNITY_PROFILE_SYNC_FAILED]', response.status);
    }
  } catch (error) {
    console.warn('[COMMUNITY_PROFILE_SYNC_UNAVAILABLE]', error);
  }
}

const UpdateProfileSchema = z
  .object({
    name: z.string().min(1).optional(),
    full_name: z.string().min(1).optional(),
    username: z.string().min(3).optional(),
    phone: z.string().min(1).optional(),
    location: z.string().min(1).optional(),
    bio: z.string().min(1).optional(),
    avatarUrl: z.string().min(1).optional(),
    avatar_url: z.string().min(1).optional(),
    cover_image: z.string().min(1).optional(),
    roles: z.array(z.string().min(1)).max(16).optional(),
    image_urls: z.array(z.string().min(1)).max(40).optional(),
    document_urls: z.array(z.string().min(1)).max(24).optional(),
    onboarding_step: z.string().min(1).max(64).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    profile: z.record(z.string(), z.unknown()).optional(),
    freelancer_profile: z.record(z.string(), z.unknown()).optional(),
    provider_profile: z.record(z.string(), z.unknown()).optional(),
    buyer_profile: z.record(z.string(), z.unknown()).optional(),
    media: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

export async function PUT(req: NextRequest) {
  try {
    const security = await enforceAuthRouteSecurity(req, {
      routeKey: 'update-profile',
      ipLimit: 300,
      deviceLimit: 240,
      windowSeconds: 3600,
    });
    if (!security.ok) return security.response;

    const token =
      req.headers.get('authorization')?.replace('Bearer ', '') ||
      req.cookies.get('access_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const parsed = await parseJsonBodyWithSchema(req, UpdateProfileSchema);
    if (!parsed.ok) return parsed.response;

    const {
      name,
      full_name,
      username,
      phone,
      location,
      bio,
      avatarUrl,
      avatar_url,
      cover_image,
      roles,
      image_urls,
      document_urls,
      onboarding_step,
      metadata,
      profile,
      freelancer_profile,
      provider_profile,
      buyer_profile,
      media,
    } = parsed.data;

    const ip = security.ip;
    const rl = await enforceRateLimit({
      key: `auth:update-profile:${ip}`,
      limit: 30,
      windowSeconds: 3600,
    });
    if (!rl.ok) return rl.response;

    // Call identity service to update profile
    const normalizedPayload = normalizeProfilePayloadMedia({
      name: full_name || name,
      username,
      phone,
      location,
      bio,
      avatar_url: avatar_url || avatarUrl,
      cover_image,
      roles,
      image_urls,
      document_urls,
      onboarding_step,
      metadata,
      profile,
      freelancer_profile,
      provider_profile,
      buyer_profile,
      media,
    });

    const res = await fetch(`${API_URL}/users/me`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...authSecurityHeaders(security),
      },
      body: JSON.stringify(normalizedPayload),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return NextResponse.json(
        { error: data.error || 'Failed to update profile' },
        { status: res.status },
      );
    }

    const data = await res.json();
    await syncCommunityProfile(token);
    return NextResponse.json(data);
  } catch (e) {
    console.error('Update profile error:', e);
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }
}
