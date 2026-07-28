import { expect, test } from '@playwright/test';
import {
  expectCenteredInViewport,
  expectNoHorizontalOverflow,
  expectRailItemsShareWidth,
  getZIndex,
} from './helpers/uxAssertions';
import {
  installStableApiFixtures,
  seedCriticalRoutes,
  seedSearchQuery,
} from './fixtures/lajukanFlowSeed';

const MOBILE_VIEWPORT = { width: 390, height: 844 };
const DESKTOP_VIEWPORT = { width: 1366, height: 768 };

async function installFixturesWhenRequested(
  page: Parameters<typeof installStableApiFixtures>[0],
) {
  if (process.env.E2E_USE_STABLE_FIXTURES === 'true') {
    await installStableApiFixtures(page);
  }
}

test.describe('Lajukan Indonesian critical journey', () => {
  test.use({ serviceWorkers: 'block' });

  test('home mobile is scan-friendly and rail cards keep consistent width', async ({
    page,
  }) => {
    await installFixturesWhenRequested(page);
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto('/id/home', { waitUntil: 'domcontentloaded' });

    await expect(
      page
        .locator(
          '[data-testid="home-mobile-menu-button"]:visible, [data-testid="app-header-mobile-menu-button"]:visible',
        )
        .first(),
    ).toBeVisible();
    await expect(
      page.getByTestId('home-recommendations-section').first(),
    ).toBeVisible();
    await expect(page.getByTestId('home-reels-section').first()).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await expectRailItemsShareWidth(
      page.getByTestId('home-recommendation-card'),
      {
        label: 'Rekomendasi untuk Usaha',
        minCount: 3,
      },
    );
    await expect(
      page
        .getByTestId('home-recommendation-card')
        .first()
        .getByTestId('canonical-listing-card'),
    ).toBeVisible();

    await expectRailItemsShareWidth(page.getByTestId('home-reel-card'), {
      label: 'Reels Inspirasi',
      minCount: 3,
    });
  });

  test('home search opens Explore results without extra ceremony', async ({
    page,
  }) => {
    await installFixturesWhenRequested(page);
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto('/id/home', { waitUntil: 'domcontentloaded' });

    await page
      .locator(
        '[data-testid="home-mobile-search-link"], [data-testid="app-header-mobile-search-link"]',
      )
      .first()
      .click();
    await expect(page).toHaveURL(/\/id\/explore/);

    const searchInput = page.getByTestId('search-mobile-input');
    await expect(searchInput).toBeVisible();
    await searchInput.fill(seedSearchQuery);
    await searchInput.press('Enter');

    await expect(page).toHaveURL(/\/id\/explore\?q=supplier(\+|%20)kemasan/);
    await expect(page.locator('body')).toContainText(
      /supplier|kemasan|hasil|cari/i,
    );
    await expectNoHorizontalOverflow(page);
  });

  test('community compose modal is above app chrome and centered on desktop', async ({
    page,
  }) => {
    await installFixturesWhenRequested(page);
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await page.goto('/id/community?compose=post', {
      waitUntil: 'domcontentloaded',
    });

    const dialog = page.getByTestId('community-compose-modal');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(/buat posting/i);

    const modalZ = await getZIndex(dialog);
    const chromeMaxZ = await page.evaluate(() =>
      Math.max(
        0,
        ...Array.from(
          document.querySelectorAll(
            'header, nav, [data-compact-bottom-nav="true"]',
          ),
        ).map(
          element =>
            Number.parseInt(window.getComputedStyle(element).zIndex, 10) || 0,
        ),
      ),
    );

    expect(modalZ).toBeGreaterThanOrEqual(200);
    expect(modalZ).toBeGreaterThan(chromeMaxZ);
    await expectCenteredInViewport(
      page,
      page.getByTestId('community-compose-surface'),
    );
  });

  test('top-level flow pages render on mobile without document overflow', async ({
    page,
  }) => {
    await installFixturesWhenRequested(page);
    await page.setViewportSize(MOBILE_VIEWPORT);

    for (const route of seedCriticalRoutes) {
      await test.step(route, async () => {
        await page.goto(route, { waitUntil: 'domcontentloaded' });
        await expect(page.locator('body')).toBeVisible();
        await expect(page.locator('body')).not.toHaveText('');
        await expectNoHorizontalOverflow(page, 6);
      });
    }
  });
});
