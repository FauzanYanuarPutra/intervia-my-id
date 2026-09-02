import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createBusinessProduct } = vi.hoisted(() => ({
  createBusinessProduct: vi.fn(),
}));

vi.mock('@/lib/business-server', () => ({ createBusinessProduct }));

import { POST } from './route';

describe('business product API', () => {
  beforeEach(() => {
    createBusinessProduct.mockReset();
    createBusinessProduct.mockResolvedValue({ id: 'business-1', products: [] });
  });

  it('keeps unknown stock nullable when creating a canonical product', async () => {
    const request = new Request('http://localhost/api/businesses/business-1/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Jus mangga',
        category: 'Minuman',
        priceLabel: 'Rp10.000',
        sourceType: 'owned',
        stockCount: null,
        minStockAlert: null,
        stockUnit: 'botol',
        stockMode: 'manual',
      }),
    });

    const response = await POST(request, {
      params: Promise.resolve({ businessId: 'business-1' }),
    });

    expect(response.status).toBe(200);
    expect(createBusinessProduct).toHaveBeenCalledWith(
      'business-1',
      expect.objectContaining({ stockCount: null, minStockAlert: null }),
    );
  });
});
