import { beforeEach, describe, expect, it, vi } from 'vitest';

const { deleteControlRecipe, getControlRecipe, listControlRecipeHistory, replaceControlRecipe } = vi.hoisted(() => ({
  deleteControlRecipe: vi.fn(),
  getControlRecipe: vi.fn(),
  listControlRecipeHistory: vi.fn(),
  replaceControlRecipe: vi.fn(),
}));

vi.mock('@/lib/business-control-server', () => ({
  BusinessControlHttpError: class BusinessControlHttpError extends Error {
    readonly status: number;
    readonly code: string;

    constructor(status: number, code: string) {
      super(code);
      this.status = status;
      this.code = code;
    }
  },
  deleteControlRecipe,
  getControlRecipe,
  listControlRecipeHistory,
  replaceControlRecipe,
}));

import { DELETE, GET } from './route';

describe('business product recipe API', () => {
  beforeEach(() => {
    deleteControlRecipe.mockReset();
    getControlRecipe.mockReset();
    listControlRecipeHistory.mockReset();
    replaceControlRecipe.mockReset();
  });

  it('forwards active recipe deletion with an accountability reason', async () => {
    deleteControlRecipe.mockResolvedValue({ data: { retired: true } });

    const response = await DELETE(
      new Request('http://localhost/api/businesses/business-1/products/product-1/recipe', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Bahan salah input' }),
      }),
      { params: Promise.resolve({ businessId: 'business-1', productId: 'product-1' }) },
    );

    expect(response.status).toBe(200);
    expect(deleteControlRecipe).toHaveBeenCalledWith(
      'business-1',
      'product-1',
      expect.objectContaining({ reason: 'Bahan salah input' }),
    );
  });

  it('returns recipe history with PIC audit events when requested', async () => {
    listControlRecipeHistory.mockResolvedValue([
      { event_key: 'recipe.retired', actor_user_id: 'user-1', reason: 'Bahan salah input' },
    ]);

    const response = await GET(
      new Request('http://localhost/api/businesses/business-1/products/product-1/recipe?history=1'),
      { params: Promise.resolve({ businessId: 'business-1', productId: 'product-1' }) },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(listControlRecipeHistory).toHaveBeenCalledWith('business-1', 'product-1');
    expect(payload.data.history[0]).toEqual(
      expect.objectContaining({ event_key: 'recipe.retired', actor_user_id: 'user-1' }),
    );
  });
});
