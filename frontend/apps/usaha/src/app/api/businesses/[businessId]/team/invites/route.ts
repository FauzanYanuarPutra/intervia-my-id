import { NextResponse } from 'next/server';
import { readAccessToken } from '@/lib/auth-session';
import { getBusinessForCurrentActor } from '@/lib/business-server';
import type { PortalRole } from '@/lib/portal-types';
import { normalizeBusinessApiError } from '@/lib/business-api-error';

const IDENTITY_URL =
  process.env.INTERNAL_API_URL ||
  process.env.INTERNAL_IDENTITY_URL ||
  'http://identity_service:8080';

const organizationRoleByPortalRole: Partial<Record<PortalRole, string>> = {
  manager: 'org_manager',
  cashier: 'org_cashier',
  viewer: 'org_viewer',
};

export async function POST(
  request: Request,
  context: { params: Promise<{ businessId: string }> },
) {
  const { businessId } = await context.params;
  try {
    const [business, token] = await Promise.all([
      getBusinessForCurrentActor(businessId),
      readAccessToken(),
    ]);

    if (!business) {
      return NextResponse.json({ error: 'Usaha tidak ditemukan.' }, { status: 404 });
    }
    if (!token) {
      return NextResponse.json({ error: 'Sesi login sudah berakhir.' }, { status: 401 });
    }
    if (!business.permissions.includes('inviteMembers')) {
      return NextResponse.json(
        { error: 'Kamu tidak punya izin mengundang anggota.' },
        { status: 403 },
      );
    }
    if (!business.organizationId) {
      return NextResponse.json(
        { error: 'Workspace usaha belum terhubung ke organisasi Lajukan.' },
        { status: 409 },
      );
    }

    const body = (await request.json()) as {
      username?: string;
      role?: PortalRole;
    };
    const username = body.username?.trim().replace(/^@/, '') || '';
    const role = organizationRoleByPortalRole[body.role ?? 'cashier'];

    if (username.length < 3 || !role) {
      return NextResponse.json(
        { error: 'Username atau peran anggota belum valid.' },
        { status: 400 },
      );
    }

    const upstream = await fetch(
      `${IDENTITY_URL}/organizations/${encodeURIComponent(business.organizationId)}/invitations`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ username, role }),
        cache: 'no-store',
      },
    );
    const payload = await upstream.text();

    if (!upstream.ok) {
      let message = 'Undangan belum berhasil dikirim.';
      try {
        const parsed = JSON.parse(payload) as { error?: string; message?: string };
        message = parsed.error || parsed.message || message;
      } catch {
        // Keep a safe generic message when the upstream body is not JSON.
      }
      return NextResponse.json({ error: message }, { status: upstream.status });
    }

    return new NextResponse(payload, {
      status: upstream.status,
      headers: {
        'Content-Type': upstream.headers.get('content-type') || 'application/json',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    const normalized = normalizeBusinessApiError(error, 'Gagal kirim undangan.');
    return NextResponse.json(
      { error: normalized.message, code: normalized.code },
      { status: normalized.status },
    );
  }
}
