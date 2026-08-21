import { expect, test } from '@playwright/test';

test('search to checkout uses idempotent transaction offer', async ({ request }) => {
  const searchRes = await request.get('/api/content?limit=10');
  expect(searchRes.status()).toBeLessThan(500);

  const searchData = (await searchRes.json().catch(() => ({}))) as {
    items?: Array<{ id?: string }>;
  };

  const contentId = searchData.items?.find((item) => item.id)?.id;
  test.skip(!contentId, 'No marketplace content found for checkout test.');

  const bearer = process.env.E2E_BEARER_TOKEN;
  test.skip(!bearer, 'Set E2E_BEARER_TOKEN to execute checkout transaction path.');

  const idempotencyKey = `e2e-offer-${Date.now()}`;
  const payload = {
    content_id: contentId,
    amount_cents: 10000,
    currency: 'IDR',
    offer_message: 'E2E idempotent offer',
  };

  const first = await request.post('/api/transactions/offer', {
    headers: {
      Authorization: `Bearer ${bearer}`,
      'X-Idempotency-Key': idempotencyKey,
    },
    data: payload,
  });
  const firstBody = await first.text();

  const second = await request.post('/api/transactions/offer', {
    headers: {
      Authorization: `Bearer ${bearer}`,
      'X-Idempotency-Key': idempotencyKey,
    },
    data: payload,
  });
  const secondBody = await second.text();

  expect(second.status()).toBe(first.status());
  expect(secondBody).toBe(firstBody);
});
