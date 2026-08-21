import { NextRequest } from 'next/server';
import { proxyListingDraftRequest } from '../_proxy';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  return proxyListingDraftRequest(
    req,
    `/v1/listing-drafts/${encodeURIComponent(id)}`,
    { method: 'GET' },
  );
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  return proxyListingDraftRequest(
    req,
    `/v1/listing-drafts/${encodeURIComponent(id)}`,
    { method: 'PATCH' },
  );
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  return proxyListingDraftRequest(
    req,
    `/v1/listing-drafts/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
  );
}
