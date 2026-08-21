import { expect, test, type Page } from '@playwright/test';
import { installStableApiFixtures } from './fixtures/lajukanFlowSeed';

const MOBILE_VIEWPORT = { width: 360, height: 760 };

type ScrollState = {
  bodyLockedData: string | null;
  bodyOverflowY: string;
  bodyPosition: string;
  htmlMatchesAppShell: boolean;
  htmlOverflowY: string;
  innerHeight: number;
  modalCount: number;
  scrollHeight: number;
};

async function readScrollState(page: Page): Promise<ScrollState> {
  return page.evaluate(() => {
    const scrollingElement = document.scrollingElement || document.documentElement;
    const bodyStyle = window.getComputedStyle(document.body);
    const htmlStyle = window.getComputedStyle(document.documentElement);

    return {
      bodyLockedData: document.documentElement.dataset.bodyScrollLocked || null,
      bodyOverflowY: bodyStyle.overflowY,
      bodyPosition: bodyStyle.position,
      htmlMatchesAppShell: document.documentElement.matches('[data-app-viewport-shell]'),
      htmlOverflowY: htmlStyle.overflowY,
      innerHeight: window.innerHeight,
      modalCount: document.querySelectorAll('.ui-layer-modal, [aria-modal="true"]').length,
      scrollHeight: scrollingElement.scrollHeight,
    };
  });
}

async function expectDocumentRouteCanScroll(page: Page, path: string) {
  await page.goto(path, { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);

  const before = await readScrollState(page);
  expect(before.scrollHeight, `${path} should be taller than the mobile viewport`).toBeGreaterThan(
    before.innerHeight + 24,
  );
  expect(before.bodyPosition, `${path} body must not be fixed`).not.toBe('fixed');
  expect(before.bodyOverflowY, `${path} body must allow vertical scroll`).not.toBe('hidden');
  expect(before.htmlOverflowY, `${path} html must allow vertical scroll`).not.toBe('hidden');
  expect(before.bodyLockedData, `${path} must not leave body scroll lock active`).toBeNull();
  expect(before.htmlMatchesAppShell, `${path} html must not match app-shell selector`).toBe(false);
  expect(before.modalCount, `${path} must not auto-open blocking modals`).toBe(0);

  await page.mouse.move(180, 380);
  await page.mouse.wheel(0, 900);
  await page.waitForTimeout(250);
  const afterWheel = await page.evaluate(() => window.scrollY);
  expect(afterWheel, `${path} should scroll after wheel input`).toBeGreaterThan(0);

  await page.evaluate(() => window.scrollTo(0, 0));
}

async function installAuthenticatedBrowserSession(page: Page) {
  await page.context().addCookies([
    {
      name: 'refresh_token',
      value: 'e2e-refresh-token',
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
    {
      name: 'session_id',
      value: 'e2e-session-id',
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
    {
      name: 'auth_present',
      value: '1',
      domain: 'localhost',
      path: '/',
      httpOnly: false,
      sameSite: 'Lax',
    },
  ]);
  await page.route('**/api/auth/refresh', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ access_token: 'e2e-access-token' }),
    }),
  );
  await page.route('**/api/auth/me', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'e2e-user-001',
        email: 'e2e@lajukan.test',
        full_name: 'E2E User',
        roles: ['user'],
        permissions: [],
      }),
    }),
  );
}

test.describe('mobile document scroll regression', () => {
  test.use({
    viewport: MOBILE_VIEWPORT,
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  });

  for (const path of ['/id/home', '/id/explore', '/id/about', '/id/terms']) {
    test(`${path} keeps document scrolling enabled`, async ({ page }) => {
      await expectDocumentRouteCanScroll(page, path);
    });
  }

  test('document routes unlock after visiting an app-shell route', async ({ page }) => {
    await page.goto('/id/umkm', { waitUntil: 'networkidle' });
    await page.waitForTimeout(700);
    const shellState = await readScrollState(page);
    expect(shellState.bodyLockedData).toBe('true');

    await expectDocumentRouteCanScroll(page, '/id/home');
    await expectDocumentRouteCanScroll(page, '/id/explore');
  });

  test('home scrolls after opening reels and using browser back', async ({
    page,
  }) => {
    await installAuthenticatedBrowserSession(page);
    await installStableApiFixtures(page);
    await page.goto('/id/home', { waitUntil: 'domcontentloaded' });
    await page.goto('/id/reels', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(700);

    expect(new URL(page.url()).pathname).toBe('/id/reels');

    await page.goBack({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(700);

    const path = new URL(page.url()).pathname;
    expect(path).toBe('/id/home');

    const homeState = await readScrollState(page);
    expect(homeState.bodyPosition, 'home body must not stay fixed').not.toBe(
      'fixed',
    );
    expect(homeState.bodyOverflowY, 'home body must allow scroll').not.toBe(
      'hidden',
    );
    expect(homeState.htmlOverflowY, 'home html must allow scroll').not.toBe(
      'hidden',
    );
    expect(homeState.bodyLockedData, 'home must clear scroll-lock data').toBeNull();

    await page.mouse.move(180, 380);
    await page.mouse.wheel(0, 900);
    await expect
      .poll(() => page.evaluate(() => window.scrollY))
      .toBeGreaterThan(0);
  });
});
