import { expect, type Locator, type Page } from '@playwright/test';

export async function expectNoHorizontalOverflow(page: Page, maxExtraPx = 4) {
  const size = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth,
  }));

  expect(size.scrollWidth, `document overflow: ${JSON.stringify(size)}`).toBeLessThanOrEqual(
    size.clientWidth + maxExtraPx,
  );
  expect(size.bodyScrollWidth, `body overflow: ${JSON.stringify(size)}`).toBeLessThanOrEqual(
    size.clientWidth + maxExtraPx,
  );
}

export async function expectRailItemsShareWidth(
  locator: Locator,
  options: { minCount?: number; tolerancePx?: number; label?: string } = {},
) {
  const minCount = options.minCount ?? 2;
  const tolerancePx = options.tolerancePx ?? 2;
  await expect(locator.first()).toBeVisible();

  const widths = await locator.evaluateAll((nodes, count) =>
    nodes
      .map(node => Math.round((node as HTMLElement).getBoundingClientRect().width))
      .filter(width => width > 0)
      .slice(0, Number(count)),
    Math.max(minCount, 3),
  );

  expect(widths.length, `${options.label || 'rail'} item count`).toBeGreaterThanOrEqual(minCount);
  const min = Math.min(...widths);
  const max = Math.max(...widths);
  expect(max - min, `${options.label || 'rail'} widths: ${widths.join(', ')}`).toBeLessThanOrEqual(
    tolerancePx,
  );
}

export async function expectCenteredInViewport(page: Page, locator: Locator, tolerancePx = 48) {
  const [viewport, box] = await Promise.all([
    page.viewportSize(),
    locator.boundingBox(),
  ]);

  expect(viewport).not.toBeNull();
  expect(box).not.toBeNull();
  if (!viewport || !box) return;

  const viewportCenterX = viewport.width / 2;
  const viewportCenterY = viewport.height / 2;
  const elementCenterX = box.x + box.width / 2;
  const elementCenterY = box.y + box.height / 2;

  expect(Math.abs(elementCenterX - viewportCenterX), `x center ${elementCenterX}`).toBeLessThanOrEqual(
    tolerancePx,
  );
  expect(Math.abs(elementCenterY - viewportCenterY), `y center ${elementCenterY}`).toBeLessThanOrEqual(
    tolerancePx,
  );
}

export async function getZIndex(locator: Locator) {
  const zIndex = await locator.first().evaluate(node => window.getComputedStyle(node).zIndex);
  return Number.parseInt(zIndex, 10) || 0;
}
