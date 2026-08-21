import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow } from './helpers/uxAssertions';

type StoreFixture = {
  name: string;
  slug: string;
  phone?: string | null;
  is_active?: boolean;
  metadata?: Record<string, unknown> | null;
};

function hasOperationalEvidence(metadata: Record<string, unknown>): boolean {
  return [
    'open_hours',
    'outlet_active',
    'live_now',
    'auto_live_schedule_enabled',
    'live_schedule_days',
    'live_schedule_start',
    'live_schedule_end',
  ].some(key => Object.prototype.hasOwnProperty.call(metadata, key));
}

function explicitStoreImageCount(metadata: Record<string, unknown>): number {
  const singularKeys = [
    'store_photo_url',
    'cover_image_url',
    'cover_url',
    'banner_url',
    'image_url',
    'imageUrl',
    'image',
    'menu_photo_url',
  ];
  const arrayKeys = ['gallery_images', 'gallery', 'images', 'photos'];
  const values = [
    ...singularKeys.map(key => metadata[key]),
    ...arrayKeys.flatMap(key => {
      const value = metadata[key];
      return Array.isArray(value)
        ? value
        : typeof value === 'string'
          ? value.split(/[,\n]/)
          : [];
    }),
  ]
    .filter((value): value is string => typeof value === 'string')
    .map(value => value.trim())
    .filter(value => value && !value.includes('/images/placeholders/'));

  return new Set(values).size;
}

test('public UMKM storefront is scan-first, honest, and mobile safe', async ({
  page,
  request,
}) => {
  const response = await request.get('/api/super-app/umkm/stores?limit=10');
  expect(response.ok()).toBeTruthy();

  const payload = (await response.json()) as {
    data?: { items?: StoreFixture[] };
    items?: StoreFixture[];
  };
  const stores = payload.data?.items || payload.items || [];
  const store = stores.find(item => item.is_active !== false && item.slug);
  expect(store?.slug).toBeTruthy();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/id/toko/${store!.slug}`, {
    waitUntil: 'domcontentloaded',
  });

  const summary = page.getByTestId('storefront-summary');
  await expect(summary).toBeVisible();
  await expect(
    summary.getByRole('heading', { level: 1, name: store!.name }),
  ).toBeVisible();
  await expect(page.getByTestId('storefront-products')).toBeVisible();
  await expect(
    page.getByTestId('storefront-primary-action-mobile'),
  ).toBeVisible();

  const metadata = store!.metadata || {};
  const mediaCount = Math.min(explicitStoreImageCount(metadata), 3);
  await expect(page.getByTestId('storefront-media')).toHaveAttribute(
    'data-media-count',
    String(mediaCount),
  );
  if (mediaCount === 0) {
    await expect(
      page.getByTestId('storefront-media-placeholder'),
    ).toBeVisible();
  }

  const jsonLdScripts = await page
    .locator('script[type="application/ld+json"]')
    .allTextContents();
  const storefrontJsonLd = jsonLdScripts.find(script =>
    script.includes('"@type":"LocalBusiness"'),
  );
  expect(storefrontJsonLd).toBeTruthy();
  expect(storefrontJsonLd).not.toContain('/images/placeholders/');

  const ratingCount = Number(
    metadata.rating_count ?? metadata.review_count ?? 0,
  );
  const ratingValue = Number(
    metadata.rating_avg ?? metadata.rating_average ?? 0,
  );
  if (!(ratingCount > 0 && ratingValue > 0)) {
    await expect(summary.getByText('Ulasan pelanggan')).toHaveCount(0);
  }
  if (!hasOperationalEvidence(metadata)) {
    await expect(
      summary.getByText('Status belum diperbarui', { exact: true }),
    ).toBeVisible();
    await expect(
      summary.getByText('Jam buka belum dicantumkan', { exact: true }),
    ).toBeVisible();
  }

  if (store!.phone) {
    await expect(page.getByText(store!.phone, { exact: true })).toHaveCount(0);
  } else {
    await expect(
      page.locator(
        'main a[href^="tel:"], main a[href^="https://wa.me/"], a[data-testid^="storefront-primary-action"][href^="tel:"], a[data-testid^="storefront-primary-action"][href^="https://wa.me/"]',
      ),
    ).toHaveCount(0);
  }
  await expectNoHorizontalOverflow(page, 6);
});
