import { NextRequest } from 'next/server';
import {
  CREATION_DRAFT_ID,
  invalidCreationDraftId,
  proxyCreationDraftRequest,
} from '@/lib/server/creationDraftProxy';

type RouteContext = { params: Promise<{ draftId: string }> };

export async function POST(req: NextRequest, context: RouteContext) {
  const { draftId } = await context.params;
  if (!CREATION_DRAFT_ID.test(draftId)) return invalidCreationDraftId();
  return proxyCreationDraftRequest(
    req,
    `/v1/creation-drafts/${encodeURIComponent(draftId)}/consume`,
    { method: 'POST', body: await req.text() },
  );
}

