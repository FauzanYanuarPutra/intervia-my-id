import { describe, expect, it, vi } from 'vitest';
import { createEmptyTemporaryDraft, type TemporaryCreateDraft } from './createDraftStorage';
import { createListingDraftRecoveryFetch } from './listingDraftRecoveryFetch';

const STALE_ID = 'dd11fd6d-fb2e-4715-abf3-863c3d79654b';
const REPLACEMENT_ID = '75aeb831-97cb-49bd-8215-02ad4d835682';
const OWNER_ID = 'user-a';

function staleDraft(): TemporaryCreateDraft {
  return {
    ...createEmptyTemporaryDraft(),
    draftId: STALE_ID,
    draftVersion: 7,
    intent: 'offer',
    categorySlug: 'materials-suppliers',
    subcategorySlug: 'packaging',
    industryIds: ['other'],
    currentStep: 9,
    formValues: {
      title: 'FOAM TRAY TGP',
      location: 'Bandung, Lengkong, Jawa Barat, Indonesia',
    },
    media: [
      {
        id: 'media-1',
        url: '/api/content/media/laju-chat/content/photo.jpg',
        preview: '/api/content/media/laju-chat/content/photo.jpg',
        name: 'IMG_6331.jpeg',
        status: 'uploaded',
      },
    ],
  };
}

function patchBody() {
  return {
    expected_version: 7,
    current_step: 9,
    values: {
      title: 'FOAM TRAY TGP',
      location: 'Bandung, Lengkong, Jawa Barat, Indonesia',
    },
    media: staleDraft().media,
    title: 'FOAM TRAY TGP',
    summary: 'Kemasan foam tray untuk kebutuhan usaha.',
    industry_ids: ['other'],
    completion_percentage: 100,
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('listing draft recovery fetch', () => {
  it('recreates a missing server draft, rotates idempotency, and retries the latest snapshot', async () => {
    let localDraft = staleDraft();
    const originalIdempotencyKey = localDraft.idempotencyKey;
    const calls: Array<{ url: string; method: string; body?: unknown }> = [];

    const baseFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
      const body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
      calls.push({ url, method, body });

      if (method === 'PATCH' && url.endsWith(`/api/listing-drafts/${STALE_ID}`)) {
        return jsonResponse({ error: 'Listing draft not found' }, 404);
      }
      if (method === 'GET' && url.endsWith(`/api/content/${STALE_ID}`)) {
        return jsonResponse({ error: 'Not found' }, 404);
      }
      if (method === 'POST' && url.endsWith('/api/listing-drafts')) {
        return jsonResponse({
          draft: { id: REPLACEMENT_ID, draft_version: 1, current_step: 9 },
        }, 201);
      }
      if (method === 'PATCH' && url.endsWith(`/api/listing-drafts/${REPLACEMENT_ID}`)) {
        return jsonResponse({
          draft: { id: REPLACEMENT_ID, draft_version: 2, current_step: 9 },
        });
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    }) as typeof fetch;

    const recoveryFetch = createListingDraftRecoveryFetch({
      ownerId: OWNER_ID,
      baseFetch,
      readDraft: () => localDraft,
      writeDraft: (_ownerId, draft) => {
        localDraft = draft;
        return draft;
      },
      baseUrl: 'https://www.lajukan.com',
    });

    const response = await recoveryFetch(`/api/listing-drafts/${STALE_ID}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-token',
      },
      credentials: 'include',
      body: JSON.stringify(patchBody()),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      draft: { id: REPLACEMENT_ID, draft_version: 2 },
    });

    const createCall = calls.find(
      call => call.method === 'POST' && call.url.endsWith('/api/listing-drafts'),
    );
    expect(createCall?.body).toMatchObject({
      intent: 'offer',
      category_slug: 'materials-suppliers',
      subcategory_slug: 'packaging',
      current_step: 9,
      values: patchBody().values,
      media: patchBody().media,
    });
    expect((createCall?.body as Record<string, unknown>).idempotency_key).not.toBe(
      originalIdempotencyKey,
    );

    const retryCall = calls.find(
      call => call.method === 'PATCH' && call.url.endsWith(`/api/listing-drafts/${REPLACEMENT_ID}`),
    );
    expect(retryCall?.body).toMatchObject({ expected_version: 1, current_step: 9 });
    expect(localDraft.draftId).toBe(REPLACEMENT_ID);
    expect(localDraft.draftVersion).toBe(1);
    expect(localDraft.formValues).toEqual(patchBody().values);
    expect(localDraft.media).toEqual(patchBody().media);
  });

  it('rewrites publish from the stale id to the recovered replacement id', async () => {
    let localDraft = staleDraft();
    const publishUrls: string[] = [];

    const baseFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
      if (method === 'PATCH' && url.endsWith(`/api/listing-drafts/${STALE_ID}`)) {
        return jsonResponse({ error: 'Listing draft not found' }, 404);
      }
      if (method === 'GET' && url.endsWith(`/api/content/${STALE_ID}`)) {
        return jsonResponse({ error: 'Not found' }, 404);
      }
      if (method === 'POST' && url.endsWith('/api/listing-drafts')) {
        return jsonResponse({ draft: { id: REPLACEMENT_ID, draft_version: 1 } }, 201);
      }
      if (method === 'PATCH' && url.endsWith(`/api/listing-drafts/${REPLACEMENT_ID}`)) {
        return jsonResponse({ draft: { id: REPLACEMENT_ID, draft_version: 2 } });
      }
      if (method === 'POST' && url.includes('/publish')) {
        publishUrls.push(url);
        return jsonResponse({ listing: { id: REPLACEMENT_ID, slug: 'foam-tray-tgp' } });
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    }) as typeof fetch;

    const recoveryFetch = createListingDraftRecoveryFetch({
      ownerId: OWNER_ID,
      baseFetch,
      readDraft: () => localDraft,
      writeDraft: (_ownerId, draft) => {
        localDraft = draft;
        return draft;
      },
      baseUrl: 'https://www.lajukan.com',
    });

    await recoveryFetch(`/api/listing-drafts/${STALE_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patchBody()),
    });
    const publishResponse = await recoveryFetch(`/api/listing-drafts/${STALE_ID}/publish`, {
      method: 'POST',
    });

    expect(publishResponse.status).toBe(200);
    expect(publishUrls).toHaveLength(1);
    expect(publishUrls[0]).toContain(`/api/listing-drafts/${REPLACEMENT_ID}/publish`);
  });

  it('treats an owner-matching published content item as already published instead of duplicating it', async () => {
    let localDraft = staleDraft();
    let postCount = 0;

    const baseFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
      if (method === 'POST') postCount += 1;
      if (method === 'PATCH' && url.endsWith(`/api/listing-drafts/${STALE_ID}`)) {
        return jsonResponse({ error: 'Listing draft not found' }, 404);
      }
      if (method === 'GET' && url.endsWith(`/api/content/${STALE_ID}`)) {
        return jsonResponse({
          id: STALE_ID,
          slug: 'foam-tray-tgp',
          owner_id: OWNER_ID,
          content_status: 'active',
        });
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    }) as typeof fetch;

    const recoveryFetch = createListingDraftRecoveryFetch({
      ownerId: OWNER_ID,
      baseFetch,
      readDraft: () => localDraft,
      writeDraft: (_ownerId, draft) => {
        localDraft = draft;
        return draft;
      },
      baseUrl: 'https://www.lajukan.com',
    });

    const saveResponse = await recoveryFetch(`/api/listing-drafts/${STALE_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patchBody()),
    });
    expect(saveResponse.status).toBe(200);

    const publishResponse = await recoveryFetch(`/api/listing-drafts/${STALE_ID}/publish`, {
      method: 'POST',
    });
    expect(await publishResponse.json()).toMatchObject({
      listing: { id: STALE_ID, slug: 'foam-tray-tgp' },
    });
    expect(postCount).toBe(0);
  });

  it('fails closed when the stale id resolves to content owned by another user', async () => {
    const baseFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
      if (method === 'PATCH') return jsonResponse({ error: 'Listing draft not found' }, 404);
      if (method === 'GET' && url.includes('/api/content/')) {
        return jsonResponse({ id: STALE_ID, owner_id: 'another-user', content_status: 'active' });
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    }) as typeof fetch;

    const recoveryFetch = createListingDraftRecoveryFetch({
      ownerId: OWNER_ID,
      baseFetch,
      readDraft: () => staleDraft(),
      writeDraft: (_ownerId, draft) => draft,
      baseUrl: 'https://www.lajukan.com',
    });

    const response = await recoveryFetch(`/api/listing-drafts/${STALE_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patchBody()),
    });
    expect(response.status).toBe(404);
  });
});
