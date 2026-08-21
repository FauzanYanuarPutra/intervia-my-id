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
    const surface = page.getByTestId('community-compose-surface');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(/buat posting/i);
    await expect(
      page.getByRole('dialog', { name: /buat posting/i }),
    ).toBeVisible();
    await expect(page.getByTestId('community-compose-title-input')).toBeFocused();
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.dataset.bodyScrollLocked,
        ),
      )
      .toBe('true');
    expect(
      await dialog.evaluate(element => element.parentElement === document.body),
    ).toBe(true);

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
    await expectCenteredInViewport(page, surface);

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.dataset.bodyScrollLocked,
        ),
      )
      .toBeUndefined();
  });

  test('Explore exposes a responsive task grid and public people directory', async ({
    page,
  }) => {
    await installFixturesWhenRequested(page);

    for (const viewport of [MOBILE_VIEWPORT, DESKTOP_VIEWPORT]) {
      await page.setViewportSize(viewport);
      await page.goto('/id/explore', { waitUntil: 'domcontentloaded' });

      await expect(
        page.getByRole('heading', { name: /mau cari apa untuk usahamu/i }),
      ).toBeVisible();
      await expect(
        page.getByRole('link', { name: /cari bahan & stok/i }),
      ).toBeVisible();
      const peopleLink = page.getByRole('link', {
        name: /temukan orang & pelaku usaha/i,
      });
      await expect(peopleLink).toBeVisible();
      await expect(
        page.getByRole('link', { name: /lihat kebutuhan pembeli/i }),
      ).toBeVisible();
      await expectNoHorizontalOverflow(page, 6);
    }

    await page
      .getByRole('link', { name: /temukan orang & pelaku usaha/i })
      .click();
    await expect(page).toHaveURL(/\/id\/explore\?tab=users/);
    await expect(
      page.getByRole('heading', { name: /cari orang & pelaku usaha/i }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page, 6);
  });

  test('community compose fills mobile viewport and restores trigger focus', async ({
    page,
  }) => {
    await installFixturesWhenRequested(page);
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto('/id/community', { waitUntil: 'domcontentloaded' });

    const trigger = page
      .getByRole('button', { name: /tanya atau bagikan update usaha/i })
      .first();
    await expect(trigger).toBeVisible();
    await trigger.click();

    const surface = page.getByTestId('community-compose-surface');
    await expect(surface).toBeVisible();
    await expect(page.getByTestId('community-compose-title-input')).toBeFocused();

    const surfaceBox = await surface.boundingBox();
    expect(surfaceBox).not.toBeNull();
    if (surfaceBox) {
      expect(surfaceBox.x).toBeLessThanOrEqual(1);
      expect(surfaceBox.y).toBeLessThanOrEqual(1);
      expect(surfaceBox.width).toBeGreaterThanOrEqual(MOBILE_VIEWPORT.width - 2);
      expect(surfaceBox.height).toBeGreaterThanOrEqual(MOBILE_VIEWPORT.height - 2);
    }

    await page.evaluate(() => {
      const outsideControl = document.querySelector<HTMLElement>('header button');
      outsideControl?.focus();
    });
    await page.keyboard.press('Tab');
    expect(
      await surface.evaluate(element =>
        element.contains(document.activeElement),
      ),
    ).toBe(true);

    await page.keyboard.press('Escape');
    await expect(surface).toBeHidden();
    await expect(trigger).toBeFocused();
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
