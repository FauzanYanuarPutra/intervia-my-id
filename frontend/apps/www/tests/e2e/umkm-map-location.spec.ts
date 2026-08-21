import {
  expect,
  test,
  type BrowserContext,
  type Page,
  type Route,
} from '@playwright/test';
import { installStableApiFixtures } from './fixtures/lajukanFlowSeed';

const VIEWER_LOCATION = {
  latitude: -6.175392,
  longitude: 106.827153,
  accuracy: 18,
};

const nearbyStore = {
  id: 'location-umkm-01',
  slug: 'location-umkm-01',
  name: 'UMKM Dekat Lokasi Saya',
  description: 'Fixture usaha untuk pengujian lokasi pengguna.',
  city: 'Jakarta',
  address: 'Jakarta Pusat',
  lat: -6.1758,
  lng: 106.8275,
  phone: null,
  distance_km: 0.08,
  metadata: {
    source: 'marketplace',
    outlet_active: true,
    umkm_category: 'retail',
  },
  online_order_enabled: true,
  offline_order_enabled: true,
};

type RequestedViewerPoint = {
  lat: string;
  lng: string;
};

async function fulfillJson(route: Route, payload: unknown) {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(payload),
  });
}

async function installUmkmFixture(
  page: Page,
  requestedViewerPoints: RequestedViewerPoint[] = [],
) {
  await installStableApiFixtures(page);
  await page.route('**/api/super-app/umkm/stores?**', route => {
    const url = new URL(route.request().url());
    const viewerLat = url.searchParams.get('viewer_lat');
    const viewerLng = url.searchParams.get('viewer_lng');
    const referencesOnly = url.searchParams.get('references_only') === '1';

    if (!referencesOnly && viewerLat && viewerLng) {
      requestedViewerPoints.push({ lat: viewerLat, lng: viewerLng });
    }

    return fulfillJson(route, {
      data: {
        items: referencesOnly ? [] : [nearbyStore],
        count: referencesOnly ? 0 : 1,
        loaded_count: referencesOnly ? 0 : 1,
        has_more: false,
        next_offset: null,
      },
    });
  });
}

async function installGeolocationFailure(
  page: Page,
  code: 1 | 2 | 3,
  message: string,
) {
  await page.addInitScript(
    ({ errorCode, errorMessage }) => {
      const positionError = {
        code: errorCode,
        message: errorMessage,
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
      };
      const fail = (
        _success: PositionCallback,
        onError?: PositionErrorCallback | null,
      ) => {
        window.setTimeout(() => {
          onError?.(positionError as GeolocationPositionError);
        }, 0);
      };

      Object.defineProperty(window.navigator, 'geolocation', {
        configurable: true,
        value: {
          clearWatch: () => undefined,
          getCurrentPosition: fail,
          watchPosition: (
            success: PositionCallback,
            onError?: PositionErrorCallback | null,
          ) => {
            fail(success, onError);
            return 1;
          },
        },
      });
    },
    { errorCode: code, errorMessage: message },
  );
}

async function openUmkmMap(page: Page, context: BrowserContext) {
  await context.clearPermissions();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/id/umkm?view=map', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('umkm-locate-me')).toBeVisible();
  // Client components are server-rendered before their click handlers are
  // hydrated. Leaflet is client-only, so its container is the reliable signal
  // that the locate controls are interactive rather than just visible HTML.
  await expect(page.locator('.leaflet-container')).toBeVisible();
}

test.describe('UMKM map current location', () => {
  test.use({ serviceWorkers: 'block' });

  test('shows my location and accuracy while sending only three-decimal viewer coordinates', async ({
    context,
    page,
  }) => {
    const requestedViewerPoints: RequestedViewerPoint[] = [];
    await context.setGeolocation(VIEWER_LOCATION);
    await installUmkmFixture(page, requestedViewerPoints);
    await openUmkmMap(page, context);

    await context.grantPermissions(['geolocation']);
    await page.getByTestId('umkm-locate-me').click();

    await expect(
      page.getByTestId('umkm-current-location-marker'),
    ).toBeVisible();
    await expect(page.getByTestId('umkm-location-accuracy')).toBeVisible();
    await expect(page.getByTestId('umkm-location-status')).toContainText(
      /Lokasi saya/i,
    );
    await expect(page.getByTestId('umkm-location-status')).toContainText(
      /18\s*m/i,
    );

    await expect
      .poll(() => requestedViewerPoints.length, {
        message: 'a store request should include the coarse viewer position',
      })
      .toBeGreaterThan(0);

    for (const point of requestedViewerPoints) {
      expect(point.lat).toMatch(/^-?\d+\.\d{3}$/);
      expect(point.lng).toMatch(/^-?\d+\.\d{3}$/);
      expect(point).toEqual({ lat: '-6.175', lng: '106.827' });
    }
  });

  test('shows the complete permission-denied status and no current-location marker', async ({
    context,
    page,
  }) => {
    await installGeolocationFailure(page, 1, 'Permission denied by test');
    await installUmkmFixture(page);
    await openUmkmMap(page, context);

    await page.getByTestId('umkm-locate-me').click();

    await expect(page.getByTestId('umkm-location-status')).toContainText(
      'Izin lokasi ditolak. Izinkan GPS lalu coba lagi.',
    );
    await expect(page.getByTestId('umkm-current-location-marker')).toHaveCount(
      0,
    );
    await expect(page.getByTestId('umkm-location-accuracy')).toHaveCount(0);
  });

  test('shows the complete unavailable-location status and allows retry', async ({
    context,
    page,
  }) => {
    await installGeolocationFailure(page, 2, 'Position unavailable by test');
    await installUmkmFixture(page);
    await openUmkmMap(page, context);

    const locateMe = page.getByTestId('umkm-locate-me');
    await locateMe.click();

    await expect(page.getByTestId('umkm-location-status')).toContainText(
      'Lokasi saya belum bisa dibaca. Coba lagi.',
    );
    await expect(locateMe).toBeEnabled();
    await expect(locateMe).toHaveAttribute('aria-busy', 'false');
  });
});
