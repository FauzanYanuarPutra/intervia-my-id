import { NextRequest } from 'next/server';
import { proxyListingDraftRequest } from '../../_proxy';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  return proxyListingDraftRequest(
    req,
    `/v1/listing-drafts/${encodeURIComponent(id)}/publish`,
    { method: 'POST' },
  );
}
