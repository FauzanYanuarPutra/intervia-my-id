import type { ComponentProps } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/i18n/navigation', () => ({ Link: 'a' }));

import { MapQuickControls } from './UmkmPlacesChromePrimitives';

function renderControls(
  overrides: Partial<ComponentProps<typeof MapQuickControls>> = {},
): string {
  const props: ComponentProps<typeof MapQuickControls> = {
    isId: true,
    interactive: true,
    routeEnabled: false,
    onToggleInteractive: vi.fn(),
    onFocusViewer: vi.fn(),
    onToggleRoute: vi.fn(),
    locationState: 'idle',
    ...overrides,
  };

  return renderToStaticMarkup(<MapQuickControls {...props} />);
}

describe('MapQuickControls location state', () => {
  it('exposes an accessible locate-me control', () => {
    const html = renderControls();

    expect(html).toContain('data-testid="umkm-locate-me"');
    expect(html).toContain('aria-label="Lokasi saya"');
  });

  it('disables the locate-me control while geolocation is in progress', () => {
    const html = renderControls({
      locating: true,
      locationState: 'locating',
    });

    expect(html).toContain('data-testid="umkm-locate-me"');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('disabled=""');
  });

  it('shows the complete permission-denied explanation', () => {
    const locationError = 'Izin lokasi ditolak. Izinkan GPS lalu coba lagi.';
    const html = renderControls({
      locationError,
      locationState: 'denied',
    });

    expect(html).toContain('data-testid="umkm-location-status"');
    expect(html).toContain(locationError);
  });

  it('shows an actionable unavailable-location explanation', () => {
    const locationError = 'Lokasi saya belum bisa dibaca. Coba lagi.';
    const html = renderControls({
      locationError,
      locationState: 'error',
    });

    expect(html).toContain('data-testid="umkm-location-status"');
    expect(html).toContain(locationError);
  });

  it('shows that location is ready together with its accuracy', () => {
    const html = renderControls({
      locationReady: true,
      locationAccuracyMeters: 18,
      locationState: 'ready',
    });

    expect(html).toContain('data-testid="umkm-location-status"');
    expect(html).toContain('Lokasi saya');
    expect(html).toContain('\u00b118 m');
  });
});
