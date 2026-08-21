import { expect, test } from '@playwright/test';

test('real-time chat entrypoint is reachable', async ({ page, request }) => {
  await page.goto('/en/chat');
  await expect(page).toHaveURL(/\/chat/);

  const bearer = process.env.E2E_BEARER_TOKEN;
  if (!bearer) {
    await expect(page.locator('body')).toContainText(/chat|login|masuk/i);
    return;
  }

  const inboxRes = await request.get('/api/chat/inbox', {
    headers: {
      Authorization: `Bearer ${bearer}`,
    },
  });

  expect(inboxRes.status()).toBeLessThan(500);
});
