import { expect, test, type Page } from '@playwright/test';
import { installStableApiFixtures } from './fixtures/lajukanFlowSeed';
import { expectNoHorizontalOverflow } from './helpers/uxAssertions';

const FOOTER_ROUTES = ['/id/home', '/id/community', '/id/about'];

async function openStableRoute(page: Page, route: string) {
  const response = await page.goto(route, { waitUntil: 'domcontentloaded' });
  expect(response?.ok(), `HTTP response for ${route}`).toBe(true);
  await expect(page.locator('body')).toBeVisible();
}

test.describe('shared page shell and footer contract', () => {
  test.beforeEach(async ({ page }) => {
    await installStableApiFixtures(page);
  });

  test('regular desktop pages render one reachable full-width footer', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    for (const route of FOOTER_ROUTES) {
      await test.step(route, async () => {
        await openStableRoute(page, route);

        const footer = page.getByTestId('site-footer');
        await expect(footer).toHaveCount(1);
        await footer.scrollIntoViewIfNeeded();
        await expect(footer).toBeVisible();

        const geometry = await footer.evaluate(node => {
          const rect = node.getBoundingClientRect();
          return {
            documentHeight: document.documentElement.scrollHeight,
            footerBottomInDocument: rect.bottom + window.scrollY,
            viewportWidth: document.documentElement.clientWidth,
            width: rect.width,
            x: rect.x,
          };
        });

        expect(geometry.footerBottomInDocument).toBeLessThanOrEqual(
          geometry.documentHeight + 1,
        );
        expect(geometry.x).toBeCloseTo(0, 0);
        expect(geometry.width).toBeCloseTo(geometry.viewportWidth, 0);
        await expectNoHorizontalOverflow(page, 2);
      });
    }
  });

  test('header, standard content, and footer use the same desktop shell', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openStableRoute(page, '/id/about');

    const shellGeometry = await page.evaluate(() => {
      const readBox = (selector: string) => {
        const node = document.querySelector<HTMLElement>(selector);
        if (!node) return null;
        const rect = node.getBoundingClientRect();
        const style = window.getComputedStyle(node);
        return {
          contentLeft: rect.left + Number.parseFloat(style.paddingLeft || '0'),
          contentRight:
            rect.right - Number.parseFloat(style.paddingRight || '0'),
          left: rect.left,
          right: rect.right,
          width: rect.width,
        };
      };

      return {
        footer: readBox('[data-testid="site-footer"] .page-shell'),
        header: readBox('.lajukan-header-shell.page-shell'),
        main: readBox('main.page-shell'),
      };
    });

    expect(shellGeometry.header).not.toBeNull();
    expect(shellGeometry.main).not.toBeNull();
    expect(shellGeometry.footer).not.toBeNull();

    const header = shellGeometry.header!;
    const main = shellGeometry.main!;
    const footer = shellGeometry.footer!;

    expect(header.width).toBeLessThanOrEqual(1280.5);
    expect(main.width).toBeLessThanOrEqual(1280.5);
    expect(footer.width).toBeLessThanOrEqual(1280.5);
    expect(Math.abs(header.contentLeft - main.contentLeft)).toBeLessThanOrEqual(
      1,
    );
    expect(Math.abs(main.contentLeft - footer.contentLeft)).toBeLessThanOrEqual(
      1,
    );
    expect(
      Math.abs(header.contentRight - main.contentRight),
    ).toBeLessThanOrEqual(1);
    expect(
      Math.abs(main.contentRight - footer.contentRight),
    ).toBeLessThanOrEqual(1);
  });

  test('mobile footer clears the fixed bottom navigation', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    for (const route of ['/id/home', '/id/community']) {
      await test.step(route, async () => {
        await openStableRoute(page, route);
        await expect(page.getByTestId('site-footer')).toHaveCount(1);

        const clearance = await page.evaluate(() => {
          window.scrollTo(0, document.documentElement.scrollHeight);
          const footer = document.querySelector<HTMLElement>(
            '[data-testid="site-footer"]',
          );
          const nav = document.querySelector<HTMLElement>(
            '[data-testid="mobile-bottom-nav"]',
          );
          if (!footer || !nav) return null;
          return (
            nav.getBoundingClientRect().top -
            footer.getBoundingClientRect().bottom
          );
        });

        expect(clearance).not.toBeNull();
        expect(clearance!).toBeGreaterThanOrEqual(0);
        await expectNoHorizontalOverflow(page, 2);
      });
    }
  });
});
