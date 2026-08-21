import { expect, test, type Page } from '@playwright/test';
import { installStableApiFixtures } from './fixtures/lajukanFlowSeed';
import { expectNoHorizontalOverflow } from './helpers/uxAssertions';

const QUALITY_ROUTES = [
  '/id/home',
  '/id/explore',
  '/en/explore',
  '/id/trust',
  '/en/blog',
  '/id/reels',
];

const QUALITY_VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 1366, height: 768 },
];

function watchFatalBrowserErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (
      message.type() === 'error' &&
      /hydration|uncaught|chunkloaderror|application error/i.test(message.text())
    ) {
      errors.push(message.text());
    }
  });
  return errors;
}

test.describe('public page quality contract', () => {
  for (const viewport of QUALITY_VIEWPORTS) {
    test(`metadata, accessibility, and layout at ${viewport.width}x${viewport.height}`, async ({
      page,
    }) => {
      await installStableApiFixtures(page);
      await page.setViewportSize(viewport);
      const browserErrors = watchFatalBrowserErrors(page);

      for (const route of QUALITY_ROUTES) {
        await test.step(route, async () => {
          const response = await page.goto(route, {
            waitUntil: 'domcontentloaded',
          });
          expect(response?.ok(), `HTTP response for ${route}`).toBe(true);
          expect(new URL(page.url()).pathname).toBe(route);
          await expect(page.locator('body')).toBeVisible();
          await expect(page.locator('html')).toHaveAttribute(
            'lang',
            route.startsWith('/en/') ? 'en' : 'id',
          );

          await expect(page).toHaveTitle(/\S.{5,}/);
          await expect(page.locator('meta[name="description"]')).toHaveAttribute(
            'content',
            /.{30,}/,
          );
          await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
          await expect(
            page.locator('link[rel="canonical"]'),
          ).toHaveAttribute('href', /^https:\/\/www\.lajukan\.com\/(id|en)\//);

          const viewportContent =
            (await page
              .locator('meta[name="viewport"]')
              .getAttribute('content')) || '';
          expect(viewportContent).not.toMatch(
            /user-scalable\s*=\s*no|maximum-scale\s*=\s*1/i,
          );
          await expectNoHorizontalOverflow(page, 6);
        });
      }

      expect(browserErrors, browserErrors.join('\n')).toEqual([]);
    });
  }

  test('security headers and normal wheel scrolling stay active', async ({
    page,
  }) => {
    await installStableApiFixtures(page);
    await page.setViewportSize({ width: 390, height: 844 });
    const response = await page.goto('/id/home', {
      waitUntil: 'domcontentloaded',
    });
    const headers = response?.headers() || {};
    const csp = headers['content-security-policy'] || '';

    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['permissions-policy']).toContain('camera=(self)');

    const before = await page.evaluate(() => window.scrollY);
    await page.mouse.wheel(0, 700);
    await expect
      .poll(() => page.evaluate(() => window.scrollY))
      .toBeGreaterThan(before);
  });
});
