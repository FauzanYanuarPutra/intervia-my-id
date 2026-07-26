import { expect, test } from '@playwright/test';

const sellerToken = process.env.E2E_SELLER_BEARER_TOKEN;
const buyerToken = process.env.E2E_BUYER_BEARER_TOKEN;

function authHeaders(
  token: string,
  idempotencyKey?: string,
): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    ...(idempotencyKey ? { 'X-Idempotency-Key': idempotencyKey } : {}),
  };
}

function extractItems(payload: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(payload)) return payload as Array<Record<string, unknown>>;
  if (payload && typeof payload === 'object') {
    const data = payload as Record<string, unknown>;
    if (Array.isArray(data.items))
      return data.items as Array<Record<string, unknown>>;
    if (Array.isArray(data.results))
      return data.results as Array<Record<string, unknown>>;
    if (Array.isArray(data.data))
      return data.data as Array<Record<string, unknown>>;
  }
  return [];
}

test('transaction lifecycle enforces role rules and listing type lock', async ({
  request,
}) => {
  test.skip(
    !sellerToken || !buyerToken,
    'Set E2E_SELLER_BEARER_TOKEN and E2E_BUYER_BEARER_TOKEN to run transaction business-rule test.',
  );

  const unique = Date.now();
  const createRes = await request.post('/api/content/create', {
    headers: authHeaders(sellerToken!),
    data: {
      type: 'property',
      title: `E2E Property ${unique}`,
      summary: 'E2E property listing for business-rule verification.',
      body: 'Automated flow listing.',
      price_cents: 1_250_000_000,
      content_status: 'active',
      metadata: {
        sector: 'manufacturing',
        property_type: 'house',
        location: 'Jakarta',
        listing_type: 'sale',
      },
    },
  });
  expect([200, 201]).toContain(createRes.status());
  const createData = (await createRes.json().catch(() => ({}))) as {
    id?: string;
    type?: string;
    content_type?: string;
    category?: string;
    metadata?: Record<string, unknown>;
  };
  expect(typeof createData.id).toBe('string');
  expect(
    String(createData.type || createData.content_type || '').toLowerCase(),
  ).toBe('property');
  expect(String(createData.category || '').toLowerCase()).toBe('property');
  expect(String(createData.metadata?.sector || '').toLowerCase()).toBe(
    'realestate',
  );

  const contentId = createData.id as string;

  const categoryOverrideRes = await request.put(`/api/content/${contentId}`, {
    headers: authHeaders(sellerToken!),
    data: {
      category: 'job',
      metadata: {
        sector: 'technology',
        sub_sector: 'cloud_security',
      },
    },
  });
  expect(categoryOverrideRes.ok()).toBeTruthy();
  const categoryOverrideData = (await categoryOverrideRes
    .json()
    .catch(() => ({}))) as {
    content_type?: string;
    type?: string;
    category?: string;
    metadata?: Record<string, unknown>;
  };
  expect(
    String(
      categoryOverrideData.type || categoryOverrideData.content_type || '',
    ).toLowerCase(),
  ).toBe('property');
  expect(String(categoryOverrideData.category || '').toLowerCase()).toBe(
    'property',
  );
  expect(
    String(categoryOverrideData.metadata?.sector || '').toLowerCase(),
  ).toBe('realestate');
  expect(categoryOverrideData.metadata?.sub_sector).toBeUndefined();

  const listAsJobRes = await request.get(
    `/api/content?type=job&q=${encodeURIComponent(`E2E Property ${unique}`)}&limit=30&offset=0`,
  );
  expect(listAsJobRes.ok()).toBeTruthy();
  const listAsJobItems = extractItems(
    await listAsJobRes.json().catch(() => ({})),
  );
  expect(
    listAsJobItems.some(entry => String(entry.id || '') === contentId),
  ).toBeFalsy();

  const listAsPropertyRes = await request.get(
    `/api/content?type=property&q=${encodeURIComponent(`E2E Property ${unique}`)}&limit=30&offset=0`,
  );
  expect(listAsPropertyRes.ok()).toBeTruthy();
  const listAsPropertyItems = extractItems(
    await listAsPropertyRes.json().catch(() => ({})),
  );
  expect(
    listAsPropertyItems.some(entry => String(entry.id || '') === contentId),
  ).toBeTruthy();

  const updateRes = await request.put(`/api/content/${contentId}`, {
    headers: authHeaders(sellerToken!),
    data: {
      type: 'property',
      metadata: {
        sector: 'technology',
        sub_sector: 'cloud_security',
      },
    },
  });
  expect(updateRes.ok()).toBeTruthy();
  const updateData = (await updateRes.json().catch(() => ({}))) as {
    metadata?: Record<string, unknown>;
  };
  expect(String(updateData.metadata?.sector || '').toLowerCase()).toBe(
    'realestate',
  );
  expect(updateData.metadata?.sub_sector).toBeUndefined();

  const draftUnique = `${unique}-draft`;
  const draftCreateRes = await request.post('/api/content/create', {
    headers: authHeaders(sellerToken!),
    data: {
      type: 'property',
      title: `E2E Draft Property ${draftUnique}`,
      summary: 'Draft listing to validate mutable type policy.',
      body: 'Draft listing to validate mutable type policy.',
      content_status: 'draft',
      metadata: {
        sector: 'manufacturing',
      },
    },
  });
  expect([200, 201]).toContain(draftCreateRes.status());
  const draftCreateData = (await draftCreateRes.json().catch(() => ({}))) as {
    id?: string;
  };
  expect(typeof draftCreateData.id).toBe('string');
  const draftId = String(draftCreateData.id);

  const draftTypeChangeRes = await request.put(`/api/content/${draftId}`, {
    headers: authHeaders(sellerToken!),
    data: {
      type: 'job',
      metadata: {
        sector: 'technology',
        sub_sector: 'cloud_security',
      },
    },
  });
  expect(draftTypeChangeRes.ok()).toBeTruthy();
  const draftTypeChangeData = (await draftTypeChangeRes
    .json()
    .catch(() => ({}))) as {
    content_type?: string;
    type?: string;
    category?: string;
    metadata?: Record<string, unknown>;
  };
  expect(
    String(
      draftTypeChangeData.type || draftTypeChangeData.content_type || '',
    ).toLowerCase(),
  ).toBe('job');
  expect(String(draftTypeChangeData.category || '').toLowerCase()).toBe('job');
  expect(String(draftTypeChangeData.metadata?.sector || '').toLowerCase()).toBe(
    'technology',
  );
  expect(
    String(draftTypeChangeData.metadata?.sub_sector || '').toLowerCase(),
  ).toBe('cloud-security');

  const draftListAsJobRes = await request.get(
    `/api/content?type=job&q=${encodeURIComponent(`E2E Draft Property ${draftUnique}`)}&limit=30&offset=0`,
  );
  expect(draftListAsJobRes.ok()).toBeTruthy();
  const draftListAsJobItems = extractItems(
    await draftListAsJobRes.json().catch(() => ({})),
  );
  expect(
    draftListAsJobItems.some(entry => String(entry.id || '') === draftId),
  ).toBeTruthy();

  const draftListAsPropertyRes = await request.get(
    `/api/content?type=property&q=${encodeURIComponent(`E2E Draft Property ${draftUnique}`)}&limit=30&offset=0`,
  );
  expect(draftListAsPropertyRes.ok()).toBeTruthy();
  const draftListAsPropertyItems = extractItems(
    await draftListAsPropertyRes.json().catch(() => ({})),
  );
  expect(
    draftListAsPropertyItems.some(entry => String(entry.id || '') === draftId),
  ).toBeFalsy();

  const offerRes = await request.post('/api/transactions/offer', {
    headers: authHeaders(buyerToken!, `e2e-offer-${unique}`),
    data: {
      content_id: contentId,
      amount_cents: 1_250_000_000,
      currency: 'IDR',
      offer_message: 'E2E transaction flow',
      safety_checklist: {
        identity_confirmed: true,
        platform_payment_confirmed: true,
        item_detail_confirmed: true,
        anti_scam_acknowledged: true,
      },
    },
  });
  const offerData = (await offerRes.json().catch(() => ({}))) as {
    id?: string;
    code?: string;
  };
  test.skip(
    offerRes.status() === 403 && offerData.code === 'verification_required',
    'Provided buyer/seller tokens are not transaction-eligible in this environment.',
  );
  expect([200, 201]).toContain(offerRes.status());
  expect(typeof offerData.id).toBe('string');
  const transactionId = offerData.id as string;

  const acceptRes = await request.put(
    `/api/transactions/${transactionId}/accept`,
    {
      headers: authHeaders(sellerToken!, `e2e-accept-${unique}`),
      data: {},
    },
  );
  const acceptData = (await acceptRes.json().catch(() => ({}))) as {
    code?: string;
  };
  test.skip(
    acceptRes.status() === 403 && acceptData.code === 'verification_required',
    'Seller token is not transaction-eligible in this environment.',
  );
  expect(acceptRes.ok()).toBeTruthy();

  const deliverBeforeStart = await request.put(
    `/api/transactions/${transactionId}/deliver`,
    {
      headers: authHeaders(sellerToken!, `e2e-deliver-before-start-${unique}`),
      data: {
        response_message: 'Trying to skip start state',
      },
    },
  );
  expect(deliverBeforeStart.status()).toBe(409);

  const startByBuyer = await request.put(
    `/api/transactions/${transactionId}/start`,
    {
      headers: authHeaders(buyerToken!, `e2e-start-buyer-${unique}`),
      data: {},
    },
  );
  expect(startByBuyer.status()).toBe(403);

  const startBySeller = await request.put(
    `/api/transactions/${transactionId}/start`,
    {
      headers: authHeaders(sellerToken!, `e2e-start-seller-${unique}`),
      data: {},
    },
  );
  expect(startBySeller.ok()).toBeTruthy();

  const deliverBySeller = await request.put(
    `/api/transactions/${transactionId}/deliver`,
    {
      headers: authHeaders(sellerToken!, `e2e-deliver-${unique}`),
      data: {
        response_message: 'Delivered by E2E flow',
      },
    },
  );
  expect(deliverBySeller.ok()).toBeTruthy();

  const completeBySeller = await request.put(
    `/api/transactions/${transactionId}/complete`,
    {
      headers: authHeaders(sellerToken!, `e2e-complete-seller-${unique}`),
      data: {},
    },
  );
  expect(completeBySeller.status()).toBe(403);

  const completeByBuyer = await request.put(
    `/api/transactions/${transactionId}/complete`,
    {
      headers: authHeaders(buyerToken!, `e2e-complete-buyer-${unique}`),
      data: {
        response_message: 'Buyer confirms completion',
      },
    },
  );
  expect(completeByBuyer.ok()).toBeTruthy();

  const reviewRes = await request.post(
    `/api/transactions/${transactionId}/review`,
    {
      headers: authHeaders(buyerToken!, `e2e-review-${unique}`),
      data: {
        rating: 5,
        comment: 'Flow validated by automation.',
        attestationAccepted: true,
      },
    },
  );
  expect([200, 201]).toContain(reviewRes.status());

  const typeChangeRes = await request.put(`/api/content/${contentId}`, {
    headers: authHeaders(sellerToken!),
    data: {
      type: 'job',
    },
  });
  expect(typeChangeRes.status()).toBe(409);
});
