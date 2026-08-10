import { expect, test, type Route } from '@playwright/test';
import { installStableApiFixtures } from './fixtures/lajukanFlowSeed';

function batchStore(index: number) {
  const suffix = String(index).padStart(2, '0');
  return {
    id: `batch-umkm-${suffix}`,
    slug: `batch-umkm-${suffix}`,
    name: `Batch UMKM ${suffix}`,
    description: `Usaha progresif nomor ${suffix}.`,
    city: 'Jakarta',
    address: 'Jakarta',
    lat: -6.2 - index * 0.001,
    lng: 106.8,
    phone: null,
    distance_km: index * 0.11,
    metadata: {
      source: 'marketplace',
      outlet_active: true,
      umkm_category: 'retail',
    },
    online_order_enabled: true,
    offline_order_enabled: true,
  };
}

async function fulfillJson(route: Route, payload: unknown) {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(payload),
  });
}

test.describe('UMKM progressive discovery loading', () => {
  test.use({ serviceWorkers: 'block' });

  test('loads 10 at a time, then appends and deduplicates the next server page', async ({
    page,
  }) => {
    await installStableApiFixtures(page);
    const requests: Array<{ limit: number; offset: number }> = [];

    await page.route('**/api/super-app/umkm/stores?**', route => {
      const url = new URL(route.request().url());
      const limit = Number(url.searchParams.get('limit'));
      const offset = Number(url.searchParams.get('offset'));
      requests.push({ limit, offset });

      if (url.searchParams.get('references_only') === '1') {
        return fulfillJson(route, {
          data: {
            items: [],
            count: 0,
            loaded_count: 0,
            has_more: false,
            next_offset: null,
          },
        });
      }

      if (offset === 0) {
        const items = Array.from({ length: 10 }, (_, index) =>
          batchStore(index),
        );
        return fulfillJson(route, {
          data: {
            items,
            count: items.length,
            loaded_count: 10,
            has_more: true,
            next_offset: 10,
          },
        });
      }

      if (offset === 10) {
        const items = [
          batchStore(9),
          ...Array.from({ length: 9 }, (_, index) => batchStore(index + 10)),
        ];
        return fulfillJson(route, {
          data: {
            items,
            count: items.length,
            loaded_count: 20,
            has_more: false,
            next_offset: null,
          },
        });
      }

      return fulfillJson(route, {
        data: {
          items: [],
          count: 0,
          loaded_count: offset,
          has_more: false,
          next_offset: null,
        },
      });
    });

    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto('/id/umkm', { waitUntil: 'domcontentloaded' });

    await expect
      .poll(() => requests.some(request => request.offset === 0))
      .toBe(true);
    expect(
      requests.some(request => request.offset === 0 && request.limit === 10),
    ).toBe(true);
    await expect(
      page.getByTestId('umkm-business-card').filter({
        hasText: 'Batch UMKM 00',
      }),
    ).toHaveCount(1);

    const loadMore = page.locator('[data-testid="umkm-load-more"]:visible');
    await expect(loadMore).toHaveCount(1);
    await loadMore.click();

    await expect
      .poll(() => requests.some(request => request.offset === 10))
      .toBe(true);
    expect(
      requests.some(request => request.offset === 10 && request.limit === 10),
    ).toBe(true);
    await expect(page.getByTestId('umkm-business-card')).toHaveCount(19);
    await expect(
      page.getByTestId('umkm-business-card').filter({
        hasText: 'Batch UMKM 09',
      }),
    ).toHaveCount(1);
    await expect(
      page.getByTestId('umkm-business-card').filter({
        hasText: 'Batch UMKM 18',
      }),
    ).toHaveCount(1);
    await expect(loadMore).toHaveCount(0);
  });
});
