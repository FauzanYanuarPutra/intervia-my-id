import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/serverAuth';
import { normalizeProfilePayloadMedia } from '@/lib/profile/profileMedia';

const API_URL = process.env.INTERNAL_API_URL || 'http://localhost:8080';

function normalizeUserDetailPayload(payload: unknown): unknown {
  return normalizeProfilePayloadMedia(payload);
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.res;
    const { token, roles, userId } = auth.ctx;

    const isSelf = id === userId;
    const isAdmin = roles.includes('admin');
    if (!isSelf && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const targetPath = isSelf ? '/users/me' : `/users/${id}`;
    const res = await fetch(`${API_URL}${targetPath}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    const data = await res.json().catch(() => ({}));
    return NextResponse.json(normalizeUserDetailPayload(data), {
      status: res.status,
    });
  } catch (error) {
    console.error('[USER_DETAIL_API_ERROR]', error);
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }
}
