import { NextRequest } from 'next/server';
import { proxyListingDraftRequest } from './_proxy';

export async function GET(req: NextRequest) {
  return proxyListingDraftRequest(req, '/v1/listing-drafts', {
    method: 'GET',
    includeSearch: true,
  });
}

export async function POST(req: NextRequest) {
  return proxyListingDraftRequest(req, '/v1/listing-drafts', {
    method: 'POST',
  });
}
