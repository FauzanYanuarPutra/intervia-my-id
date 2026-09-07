import { describe, expect, it } from 'vitest';
import { buildMerchantNextActions } from './next-actions';

const base = {
  businessId: 'biz-1',
  canViewCosting: true,
  canViewFinance: true,
  canViewChannels: true,
  productCount: 1,
  ingredientCount: 1,
  recipeCount: 1,
  lowStockCount: 0,
  enabledChannelCount: 0,
  productsMissingChannelPriceCount: 0,
  unreconciledSettlementCount: 0,
  financeEntryCount: 1,
};

describe('buildMerchantNextActions', () => {
  it('starts with adding a product when the business has no products', () => {
    const actions = buildMerchantNextActions({ ...base, productCount: 0, ingredientCount: 0, recipeCount: 0 });
    expect(actions[0]?.kind).toBe('add_product');
    expect(actions[0]?.href).toBe('/businesses/biz-1/products');
  });

  it('guides costing users from ingredients to recipes without exposing costing setup to other roles', () => {
    expect(buildMerchantNextActions({ ...base, ingredientCount: 0, recipeCount: 0 })[0]?.kind).toBe('add_ingredient');
    expect(buildMerchantNextActions({ ...base, recipeCount: 0 })[0]?.kind).toBe('build_recipe');

    const restricted = buildMerchantNextActions({
      ...base,
      canViewCosting: false,
      ingredientCount: 0,
      recipeCount: 0,
    });
    expect(restricted.some(action => action.kind === 'add_ingredient' || action.kind === 'build_recipe')).toBe(false);
  });

  it('puts urgent low stock ahead of non-urgent setup work', () => {
    const actions = buildMerchantNextActions({
      ...base,
      recipeCount: 0,
      lowStockCount: 2,
    });
    expect(actions[0]?.kind).toBe('restock');
  });

  it('only offers settlement reconciliation for enabled channels with durable unreconciled data and finance access', () => {
    expect(buildMerchantNextActions({ ...base, unreconciledSettlementCount: 2 }).some(action => action.kind === 'reconcile_settlement')).toBe(false);
    expect(buildMerchantNextActions({ ...base, enabledChannelCount: 1 }).some(action => action.kind === 'reconcile_settlement')).toBe(false);
    expect(buildMerchantNextActions({ ...base, enabledChannelCount: 1, unreconciledSettlementCount: 2 }).some(action => action.kind === 'reconcile_settlement')).toBe(true);
    expect(buildMerchantNextActions({ ...base, canViewFinance: false, enabledChannelCount: 1, unreconciledSettlementCount: 2 }).some(action => action.kind === 'reconcile_settlement')).toBe(false);
  });

  it('never invents operational needs from absent metrics and returns a truthful healthy state', () => {
    const actions = buildMerchantNextActions(base);
    expect(actions).toEqual([
      expect.objectContaining({ kind: 'healthy', href: '/businesses/biz-1/orders' }),
    ]);
  });

  it('offers channel pricing and first money entry only when durable state and permissions say they are needed', () => {
    expect(buildMerchantNextActions({ ...base, enabledChannelCount: 1, productsMissingChannelPriceCount: 1 })[0]?.kind).toBe('set_channel_price');
    expect(buildMerchantNextActions({ ...base, canViewChannels: false, enabledChannelCount: 1, productsMissingChannelPriceCount: 1 }).some(action => action.kind === 'set_channel_price')).toBe(false);
    expect(buildMerchantNextActions({ ...base, financeEntryCount: 0 })[0]?.kind).toBe('record_money');
    expect(buildMerchantNextActions({ ...base, canViewFinance: false, financeEntryCount: 0 }).some(action => action.kind === 'record_money')).toBe(false);
  });
});
