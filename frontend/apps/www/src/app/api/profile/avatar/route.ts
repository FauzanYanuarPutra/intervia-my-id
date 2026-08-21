import { NextRequest, NextResponse } from 'next/server';
import {
  buildForwardAuthHeaders,
  type ProtectedRouteContext,
  withProtectedRoute,
} from '@/lib/api/withProtectedRoute';
import {
  profileAvatarSrc,
  readProfileAvatarStyle,
  readProfileAvatarUrl,
} from '@/lib/profile/avatar';
import {
  createLajukanAvatarDataUrl,
  readLajukanAvatarSpec,
} from '@/lib/profile/avatar2d';
import { isUploadedProfileAvatarUrl } from '@/lib/profile/profileAvatar.service';

const API_URL = process.env.INTERNAL_API_URL || 'http://localhost:8080';

type ProfileRecord = Record<string, unknown>;

function asRecord(value: unknown): ProfileRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as ProfileRecord;
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function avatarLabel(profile: unknown, fallback = 'Lajukan avatar'): string {
  const record = asRecord(profile);
  return (
    readString(record.full_name) ||
    readString(record.fullName) ||
    readString(record.username) ||
    readString(record.email) ||
    fallback
  );
}

function avatarPayload(profile: unknown) {
  const record = asRecord(profile);
  const label = avatarLabel(record);
  const avatarUrl = readProfileAvatarUrl(record);
  const avatarStyle = readLajukanAvatarSpec(readProfileAvatarStyle(record));
  const hasUploadedPhoto = isUploadedProfileAvatarUrl(avatarUrl);
  const source = hasUploadedPhoto
    ? 'photo'
    : readProfileAvatarStyle(record)
      ? 'avatar'
      : 'fallback';

  return {
    userId: readString(record.id),
    avatarUrl,
    avatarStyle,
    hasUploadedPhoto,
    source,
    src: profileAvatarSrc(avatarUrl, avatarStyle, label),
  };
}

async function fetchJson(url: string, headers: HeadersInit) {
  const res = await fetch(url, { headers, cache: 'no-store' });
  const data = await res.json().catch(() => ({}));
  return { data, res };
}

export async function GET(req: NextRequest) {
  const userId = new URL(req.url).searchParams.get('userId')?.trim();

  if (userId) {
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    const token =
      req.headers.get('authorization')?.replace('Bearer ', '') ||
      req.cookies.get('access_token')?.value;
    if (token) headers.Authorization = `Bearer ${token}`;

    const { data, res } = await fetchJson(
      `${API_URL}/users/public/${encodeURIComponent(userId)}`,
      headers,
    );
    if (!res.ok) return NextResponse.json(data, { status: res.status });
    return NextResponse.json(avatarPayload(data), { status: res.status });
  }

  return withProtectedRoute(
    req,
    { routeKey: 'profile-avatar-read', ipLimit: 300, windowSeconds: 900 },
    async ctx => {
      const { data, res } = await fetchJson(
        `${API_URL}/users/me`,
        buildForwardAuthHeaders(ctx, { 'Content-Type': 'application/json' }),
      );
      if (!res.ok) return NextResponse.json(data, { status: res.status });
      return NextResponse.json(avatarPayload(data), { status: res.status });
    },
  );
}

export async function PUT(req: NextRequest) {
  return withProtectedRoute(
    req,
    { routeKey: 'profile-avatar-save', ipLimit: 120, windowSeconds: 3600 },
    async ctx => {
      const body = asRecord(await req.json().catch(() => ({})));
      const label = readString(body.label) || 'Lajukan avatar';
      const avatarStyle = readLajukanAvatarSpec(
        body.avatar_style || body.avatarStyle || body.style,
      );
      const generatedAvatarUrl = createLajukanAvatarDataUrl(avatarStyle, label);
      const currentProfile = await readCurrentProfile(ctx);
      if (!currentProfile.res.ok) {
        return NextResponse.json(currentProfile.data, {
          status: currentProfile.res.status,
        });
      }
      const current = currentProfile.data;
      const currentAvatarUrl =
        readProfileAvatarUrl(current) || readString(body.currentAvatarUrl);
      const hasUploadedPhoto = isUploadedProfileAvatarUrl(currentAvatarUrl);
      const shouldSetAvatarUrl =
        body.useAsProfileAvatar !== false && !hasUploadedPhoto;

      const saveBody: ProfileRecord = {
        metadata: {
          avatar_style: avatarStyle,
          avatar_source: 'lajukan_avatar_builder',
          avatar_updated_at: new Date().toISOString(),
        },
      };
      if (shouldSetAvatarUrl) saveBody.avatar_url = generatedAvatarUrl;

      const updateRes = await fetch(`${API_URL}/users/me`, {
        method: 'PUT',
        headers: buildForwardAuthHeaders(ctx, {
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify(saveBody),
      });
      const updateData = await updateRes.json().catch(() => ({}));
      if (!updateRes.ok) {
        return NextResponse.json(updateData, { status: updateRes.status });
      }

      const nextProfile = asRecord(updateData);
      return NextResponse.json({
        ...avatarPayload({
          ...nextProfile,
          avatar_url: shouldSetAvatarUrl
            ? generatedAvatarUrl
            : readProfileAvatarUrl(nextProfile) || currentAvatarUrl,
          avatar_style: avatarStyle,
        }),
        hasUploadedPhoto,
      });
    },
  );
}

async function readCurrentProfile(ctx: ProtectedRouteContext) {
  return fetchJson(
    `${API_URL}/users/me`,
    buildForwardAuthHeaders(ctx, { 'Content-Type': 'application/json' }),
  );
}
