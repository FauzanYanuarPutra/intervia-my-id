import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { enforceAuthRouteSecurity } from '@/lib/authSecurity';
import { enforceRateLimit } from '@/lib/rateLimit';
import { requireAuth } from '@/lib/serverAuth';
import { parseJsonBodyWithSchema } from '@/lib/serverRequest';
import { hasUmkmStorePermission } from '@/lib/super-app/umkm-authorization';
import {
  createUmkmStoreMember,
  getUmkmStoreById,
  getUmkmStoreMemberById,
  listUmkmStoreMembers,
  updateUmkmStoreMember,
} from '@/lib/super-app/umkm-commerce';

const AssignableRoleSchema = z.enum(['manager', 'cashier', 'stock', 'ops', 'finance']);

const CreateTeamMemberSchema = z.object({
  user_id: z.string().uuid().optional(),
  email: z.string().email().max(200).optional(),
  name: z.string().min(2).max(120),
  role: AssignableRoleSchema,
  status: z.enum(['active', 'invited', 'disabled']).optional(),
  notes: z.string().max(300).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const UpdateTeamMemberSchema = z.object({
  member_id: z.string().uuid(),
  user_id: z.string().uuid().optional(),
  email: z.string().email().max(200).optional(),
  name: z.string().min(2).max(120).optional(),
  role: AssignableRoleSchema.optional(),
  status: z.enum(['active', 'invited', 'disabled']).optional(),
  notes: z.string().max(300).optional(),
  metadata_patch: z.record(z.string(), z.unknown()).optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ storeId: string }> },
) {
  try {
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.res;

    const security = await enforceAuthRouteSecurity(req, {
      routeKey: 'super-app-umkm-team-list',
      ipLimit: 220,
      deviceLimit: 180,
      windowSeconds: 3600,
    });
    if (!security.ok) return security.response;

    const resolvedParams = await params;
    const store = await getUmkmStoreById(resolvedParams.storeId);
    if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 });

    if (
      !hasUmkmStorePermission({
        storeId: store.id,
        ownerUserId: store.owner_user_id,
        actorUserId: auth.ctx.userId,
        actorEmail: auth.ctx.email,
        roles: auth.ctx.roles,
        permission: 'store:view',
      })
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const url = new URL(req.url);
    const status = (url.searchParams.get('status') || '').trim();
    const limit = Number.parseInt(url.searchParams.get('limit') || '120', 10) || 120;
    const items = await listUmkmStoreMembers({
      storeId: store.id,
      status:
        status === 'active' || status === 'invited' || status === 'disabled'
          ? status
          : undefined,
      limit,
    });

    return NextResponse.json(
      {
        data: {
          store,
          items,
          count: items.length,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('[UMKM_TEAM_GET_ERROR]', error);
    return NextResponse.json({ error: 'Failed to load UMKM team members' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ storeId: string }> },
) {
  try {
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.res;

    const security = await enforceAuthRouteSecurity(req, {
      routeKey: 'super-app-umkm-team-create',
      ipLimit: 120,
      deviceLimit: 90,
      windowSeconds: 3600,
    });
    if (!security.ok) return security.response;

    const rl = await enforceRateLimit({
      key: `superapp:umkm:team:create:${auth.ctx.userId}:${security.ip}`,
      limit: 80,
      windowSeconds: 3600,
      message: 'Too many UMKM team changes. Please retry later.',
    });
    if (!rl.ok) return rl.response;

    const resolvedParams = await params;
    const store = await getUmkmStoreById(resolvedParams.storeId);
    if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 });

    if (
      !hasUmkmStorePermission({
        storeId: store.id,
        ownerUserId: store.owner_user_id,
        actorUserId: auth.ctx.userId,
        actorEmail: auth.ctx.email,
        roles: auth.ctx.roles,
        permission: 'team:manage',
      })
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const parsed = await parseJsonBodyWithSchema(req, CreateTeamMemberSchema);
    if (!parsed.ok) return parsed.response;

    const member = await createUmkmStoreMember({
      storeId: store.id,
      userId: parsed.data.user_id,
      email: parsed.data.email,
      name: parsed.data.name,
      role: parsed.data.role,
      status: parsed.data.status,
      notes: parsed.data.notes,
      metadata: parsed.data.metadata,
    });

    return NextResponse.json({ data: member }, { status: 201 });
  } catch (error) {
    console.error('[UMKM_TEAM_CREATE_ERROR]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create UMKM team member' },
      { status: 400 },
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ storeId: string }> },
) {
  try {
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.res;

    const security = await enforceAuthRouteSecurity(req, {
      routeKey: 'super-app-umkm-team-update',
      ipLimit: 120,
      deviceLimit: 90,
      windowSeconds: 3600,
    });
    if (!security.ok) return security.response;

    const resolvedParams = await params;
    const store = await getUmkmStoreById(resolvedParams.storeId);
    if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 });

    if (
      !hasUmkmStorePermission({
        storeId: store.id,
        ownerUserId: store.owner_user_id,
        actorUserId: auth.ctx.userId,
        actorEmail: auth.ctx.email,
        roles: auth.ctx.roles,
        permission: 'team:manage',
      })
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const parsed = await parseJsonBodyWithSchema(req, UpdateTeamMemberSchema);
    if (!parsed.ok) return parsed.response;

    const currentMember = await getUmkmStoreMemberById(parsed.data.member_id);
    if (!currentMember || currentMember.store_id !== store.id) {
      return NextResponse.json({ error: 'Store member not found' }, { status: 404 });
    }

    const member = await updateUmkmStoreMember({
      memberId: parsed.data.member_id,
      userId: parsed.data.user_id,
      email: parsed.data.email,
      name: parsed.data.name,
      role: parsed.data.role,
      status: parsed.data.status,
      notes: parsed.data.notes,
      metadataPatch: parsed.data.metadata_patch,
    });

    return NextResponse.json({ data: member }, { status: 200 });
  } catch (error) {
    console.error('[UMKM_TEAM_PATCH_ERROR]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update UMKM team member' },
      { status: 400 },
    );
  }
}
