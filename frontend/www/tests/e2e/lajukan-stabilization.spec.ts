import { expect, test, type Page, type Route } from '@playwright/test';
import { expectNoHorizontalOverflow } from './helpers/uxAssertions';
import { installStableApiFixtures } from './fixtures/lajukanFlowSeed';

const REQUIRED_VIEWPORTS = [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
];

const CORE_ROUTES = [
  '/id/home',
  '/id/explore?q=supplier%20kemasan',
  '/id/umkm',
  '/id/create',
  '/id/community',
  '/id/reels',
  '/id/login?next=%2Fid%2Fcontent%2Fe2e-kemasan-001',
  '/id/register',
  '/id/support',
  '/id/content/e2e-kemasan-001',
];

const e2ePackagingImage =
  'https://images.unsplash.com/photo-1648587456176-4969b0124b12?auto=format&fit=crop&w=1200&q=80';

const e2eContentItem = {
  id: 'e2e-kemasan-001',
  title: 'Supplier kemasan paper bowl 500ml',
  summary: 'Ready stok, MOQ kecil, cocok untuk UMKM kuliner.',
  body: 'Supplier kemasan paper bowl food grade untuk kebutuhan usaha kuliner.',
  content_type: 'product',
  category: 'product',
  content_status: 'active',
  price_cents: 450000,
  currency: 'IDR',
  cover_image: e2ePackagingImage,
  image_url: e2ePackagingImage,
  tags: ['kemasan', 'paper bowl', 'supplier'],
  metadata: {
    city: 'Bandung',
    location: 'Bandung',
    latitude: -6.9175,
    longitude: 107.6191,
    market_side: 'supply',
    listing_side: 'supply',
    whatsapp_phone: '+6281234567890',
    image_credit: {
      provider: 'Unsplash',
      source_url: 'https://unsplash.com/s/photos/paper-packaging',
    },
  },
  owner_profile: {
    id: 'seller-e2e-001',
    full_name: 'Toko Kemasan Bandung',
    username: 'tokokemasan',
    location: 'Bandung',
    avatar_url: '/default-avatar.svg',
  },
  seller_stats: {
    rating: 4.8,
    review_count: 32,
  },
  created_at: '2026-05-01T08:00:00.000Z',
  updated_at: '2026-05-21T08:00:00.000Z',
};

const umkmStores = [
  {
    id: 'umkm-e2e-001',
    slug: 'warung-kemasan-e2e',
    name: 'Warung Kemasan E2E',
    description: 'Toko lokal untuk kebutuhan kemasan UMKM.',
    city: 'Bandung',
    address: 'Bandung',
    lat: -6.9175,
    lng: 107.6191,
    phone: '+6281234567890',
    distance_km: null,
    metadata: {
      umkm_category: 'retail',
      rating_avg: 4.7,
      rating_count: 12,
      whatsapp_phone: '+6281234567890',
    },
  },
];

async function fulfillJson(route: Route, payload: unknown) {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(payload),
  });
}

async function installStabilizationFixtures(page: Page) {
  await installStableApiFixtures(page);

  await page.route('**/api/content/e2e-kemasan-001**', route =>
    fulfillJson(route, e2eContentItem),
  );
  await page.route('**/api/content/e2e-kemasan-001/likes?**', route =>
    fulfillJson(route, { data: [] }),
  );
  await page.route('**/api/content/e2e-kemasan-001/reviews?**', route =>
    fulfillJson(route, { data: [] }),
  );
  await page.route('**/api/home/trending-searches?**', route =>
    fulfillJson(route, {
      data: [
        { label: 'supplier kemasan', href: '/explore?q=supplier%20kemasan' },
      ],
    }),
  );
  await page.route('**/api/super-app/umkm/stores?**', route => {
    const url = new URL(route.request().url());
    const hasViewer =
      url.searchParams.has('viewer_lat') && url.searchParams.has('viewer_lng');
    const items = umkmStores.map(store => ({
      ...store,
      distance_km: hasViewer ? 0.32 : null,
    }));
    return fulfillJson(route, { data: { items, count: items.length } });
  });
}

test.describe('Lajukan stabilization regression smoke', () => {
  test.use({ serviceWorkers: 'block' });

  for (const viewport of REQUIRED_VIEWPORTS) {
    test(`core routes avoid document overflow at ${viewport.width}x${viewport.height}`, async ({
      page,
    }) => {
      await installStabilizationFixtures(page);
      await page.setViewportSize(viewport);

      for (const route of CORE_ROUTES) {
        await test.step(route, async () => {
          await page.goto(route, { waitUntil: 'domcontentloaded' });
          await expect(page.locator('body')).toBeVisible();
          await expectNoHorizontalOverflow(page, 6);
        });
      }
    });
  }

  test('Explore keeps query in URL and does not overflow after interaction', async ({
    page,
  }) => {
    await installStabilizationFixtures(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/id/explore', { waitUntil: 'domcontentloaded' });

    const input = page
      .locator(
        '[data-testid="search-mobile-input"]:visible, input[type="search"]:visible, input[name="q"]:visible',
      )
      .first();
    await expect(input).toBeVisible();
    await input.fill('supplier kemasan');
    await input.press('Enter');

    await expect(page).toHaveURL(/\/id\/explore\?q=supplier(\+|%20)kemasan/);
    await expectNoHorizontalOverflow(page, 6);
  });

  test('content detail exposes its scan-first summary without mobile overflow', async ({
    page,
    request,
  }) => {
    await installStabilizationFixtures(page);

    const contentResponse = await request.get(
      '/api/content?limit=10&status=active',
    );
    expect(contentResponse.ok()).toBeTruthy();
    const contentPayload = (await contentResponse.json()) as {
      items?: Array<{ id?: unknown }>;
      data?: { items?: Array<{ id?: unknown }> };
    };
    const activeContent =
      contentPayload.items?.[0] || contentPayload.data?.items?.[0];
    const activeContentId =
      typeof activeContent?.id === 'string' ? activeContent.id : '';
    expect(activeContentId).not.toBe('');

    await page.route('**/api/content/**', async route => {
      const url = new URL(route.request().url());
      if (
        url.pathname === `/api/content/${activeContentId}` &&
        url.searchParams.get('include_owner') === '1'
      ) {
        await fulfillJson(route, e2eContentItem);
        return;
      }
      await route.fallback();
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/id/content/${activeContentId}`, {
      waitUntil: 'domcontentloaded',
    });

    const summary = page.getByTestId('content-detail-summary');
    await expect(summary).toBeVisible();
    await expect(
      summary.getByRole('heading', {
        level: 1,
        name: e2eContentItem.title,
      }),
    ).toBeVisible();
    await expect(
      summary.getByText('Menawarkan', { exact: true }),
    ).toBeVisible();
    await expect(
      summary.getByText(e2eContentItem.summary, { exact: true }),
    ).toBeVisible();
    await expect(
      summary.getByText(/^(?:Harga|Mulai dari chat)$/),
    ).toBeVisible();
    await expect(summary).toContainText(
      /(?:Tanya detail|(?:IDR|Rp)\s*4[.,]500)/,
    );
    await expectNoHorizontalOverflow(page, 6);
  });

  test('umkm discovery search controls stay clickable above the map layer', async ({
    page,
  }) => {
    await installStabilizationFixtures(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/id/umkm', { waitUntil: 'domcontentloaded' });

    const searchControl = page
      .locator(
        'input[type="search"], input[placeholder*="Cari"], button:has-text("Cari area ini")',
      )
      .first();
    await expect(searchControl).toBeVisible();
    await searchControl.click({ trial: true });
    await expectNoHorizontalOverflow(page, 6);
  });

  test('distance is hidden until a viewer location is available', async ({
    page,
  }) => {
    await installStabilizationFixtures(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/id/umkm', { waitUntil: 'domcontentloaded' });

    await expect(page.getByText('320 m')).toHaveCount(0);
  });
});
