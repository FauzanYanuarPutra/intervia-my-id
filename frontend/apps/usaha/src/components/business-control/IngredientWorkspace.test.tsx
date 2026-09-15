import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { IngredientWorkspace } from './IngredientWorkspace';

const ALPUKAT = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Alpukat',
  kind: 'ingredient',
  purchase_unit: 'kg',
  recipe_unit: 'gram',
  conversion_factor: 1000,
  purchase_price_amount: 0,
  purchase_quantity: 1,
  yield_percent: 100,
  waste_percent: 0,
  stock_quantity: 0,
  minimum_stock: 0,
  supplier_name: null,
};

describe('IngredientWorkspace existing ingredient management', () => {
  it('offers stock, edit, history, and archive actions for an existing ingredient', () => {
    const html = renderToStaticMarkup(
      <IngredientWorkspace
        businessId="22222222-2222-4222-8222-222222222222"
        initialIngredients={[ALPUKAT]}
      />,
    );

    expect(html).toContain('Tambah stok');
    expect(html).toContain('Edit');
    expect(html).toContain('Riwayat');
    expect(html).toContain('Arsipkan');
  });

  it('shows missing operational setup as missing instead of rendering minimum zero as healthy data', () => {
    const html = renderToStaticMarkup(
      <IngredientWorkspace
        businessId="22222222-2222-4222-8222-222222222222"
        initialIngredients={[ALPUKAT]}
      />,
    );

    expect(html).toContain('Batas minimum belum diatur');
    expect(html).toContain('Harga beli belum diisi');
    expect(html).toContain('Modal belum bisa dihitung');
    expect(html).not.toContain('minimum 0');
  });

  it('guides new ingredient setup in three simple steps and previews automatic unit conversion', () => {
    const html = renderToStaticMarkup(
      <IngredientWorkspace
        businessId="22222222-2222-4222-8222-222222222222"
        initialIngredients={[]}
      />,
    );

    expect(html).toContain('1. Bahan');
    expect(html).toContain('2. Harga &amp; satuan');
    expect(html).toContain('3. Stok &amp; supplier');
    expect(html).toContain('1 kg = 1.000 gram');
    expect(html).toContain('otomatis');
  });
});
