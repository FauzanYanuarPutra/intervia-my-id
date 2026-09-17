import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { StorefrontProductOrderAction } from './StorefrontProductOrderAction';

const BASE_PROPS = {
  storeId: '11111111-1111-4111-8111-111111111111',
  productId: '22222222-2222-4222-8222-222222222222',
  productName: 'Produk Uji',
  onlineOrderEnabled: true,
  productAvailable: true,
  isId: true,
};

describe('StorefrontProductOrderAction', () => {
  it('renders a mobile-friendly canonical order CTA when online ordering is allowed', () => {
    const html = renderToStaticMarkup(
      <StorefrontProductOrderAction {...BASE_PROPS} />,
    );

    expect(html).toContain('Pesan 1 produk');
    expect(html).toContain('aria-label="Pesan Produk Uji"');
    expect(html).not.toContain('disabled=""');
  });

  it('renders a compact menu-row action without changing canonical ordering behavior', () => {
    const html = renderToStaticMarkup(
      <StorefrontProductOrderAction {...BASE_PROPS} variant="compact" />,
    );

    expect(html).toContain('data-variant="compact"');
    expect(html).toContain('>Pesan</button>');
    expect(html).not.toContain('w-full');
    expect(html).not.toContain('disabled=""');
  });

  it('disables ordering when the store has online ordering turned off', () => {
    const html = renderToStaticMarkup(
      <StorefrontProductOrderAction
        {...BASE_PROPS}
        onlineOrderEnabled={false}
      />,
    );

    expect(html).toContain('disabled=""');
    expect(html).toContain('Pemesanan online belum dibuka oleh toko.');
  });

  it('disables ordering for an unavailable product', () => {
    const html = renderToStaticMarkup(
      <StorefrontProductOrderAction {...BASE_PROPS} productAvailable={false} />,
    );

    expect(html).toContain('disabled=""');
    expect(html).toContain('Produk ini belum tersedia untuk dipesan.');
  });
});
