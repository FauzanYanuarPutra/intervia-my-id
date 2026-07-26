import { NextRequest, NextResponse } from 'next/server';
import {
  CREATION_DRAFT_ID,
  invalidCreationDraftId,
  proxyCreationDraftRequest,
} from '@/lib/server/creationDraftProxy';

type RouteContext = { params: Promise<{ draftId: string }> };

export async function GET(req: NextRequest, context: RouteContext) {
  const { draftId } = await context.params;
  if (!CREATION_DRAFT_ID.test(draftId)) return invalidCreationDraftId();
  return proxyCreationDraftRequest(
    req,
    `/v1/creation-drafts/${encodeURIComponent(draftId)}`,
  );
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  const { draftId } = await context.params;
  if (!CREATION_DRAFT_ID.test(draftId)) return invalidCreationDraftId();
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ error: 'Invalid draft update.' }, { status: 400 });
  }
  if (Object.prototype.hasOwnProperty.call(body, 'media')) {
    return NextResponse.json(
      { error: 'Media changes must use the controlled AI upload flow.' },
      { status: 400 },
    );
  }
  return proxyCreationDraftRequest(
    req,
    `/v1/creation-drafts/${encodeURIComponent(draftId)}`,
    { method: 'PATCH', body: JSON.stringify(body) },
  );
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  const { draftId } = await context.params;
  if (!CREATION_DRAFT_ID.test(draftId)) return invalidCreationDraftId();
  return proxyCreationDraftRequest(
    req,
    `/v1/creation-drafts/${encodeURIComponent(draftId)}`,
    { method: 'DELETE' },
  );
}
