import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { IngredientWorkspaceV2 } from './IngredientWorkspaceV2';

const ALPUKAT = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Alpukat',
  kind: 'ingredient',
  purchase_unit: 'kg',
  recipe_unit: 'gram',
  conversion_factor: 1000,
  purchase_price_amount: 30_000,
  purchase_quantity: 1,
  yield_percent: 70,
  waste_percent: 0,
  stock_quantity: 1400,
  minimum_stock: 500,
  supplier_name: 'Pasar Induk',
};

describe('IngredientWorkspaceV2', () => {
  it('uses business language instead of exposing raw database fields', () => {
    const html = renderToStaticMarkup(
      <IngredientWorkspaceV2
        businessId="22222222-2222-4222-8222-222222222222"
        initialIngredients={[ALPUKAT]}
      />,
    );

    expect(html).toContain('Bagaimana biasanya bahan ini dibeli?');
    expect(html).toContain('Saya membeli');
    expect(html).toContain('Dipakai dalam resep sebagai');
    expect(html).toContain('1 kg =');
    expect(html).toContain('Ada bagian yang biasanya tidak terpakai?');
    expect(html).toContain('Bagian yang dapat digunakan');
    expect(html).not.toContain('Susut %');
    expect(html).not.toContain('Konversi</');
  });

  it('keeps stock changes auditable and unit-aware', () => {
    const html = renderToStaticMarkup(
      <IngredientWorkspaceV2
        businessId="22222222-2222-4222-8222-222222222222"
        initialIngredients={[ALPUKAT]}
      />,
    );

    expect(html).toContain('Tambah stok');
    expect(html).toContain('Riwayat');
    expect(html).toContain('Stok awal yang siap dipakai');
    expect(html).toContain('gram');
    expect(html).toContain('Beri peringatan jika stok di bawah');
  });

  it('shows effective cost and a human-readable purchase summary', () => {
    const html = renderToStaticMarkup(
      <IngredientWorkspaceV2
        businessId="22222222-2222-4222-8222-222222222222"
        initialIngredients={[ALPUKAT]}
      />,
    );

    expect(html).toContain('Rp42,86');
    expect(html).toContain('Rp30.000');
    expect(html).toContain('70% dapat digunakan');
    expect(html).toContain('30% tidak terpakai');
  });
});
