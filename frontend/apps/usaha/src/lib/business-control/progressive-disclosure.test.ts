import { describe, expect, it } from 'vitest';
import {
  channelSimulationReadiness,
  productPrimaryMode,
  sortStockAttentionFirst,
  shouldShowSettlementWorkspace,
} from './progressive-disclosure';

describe('merchant progressive disclosure', () => {
  it('sorts urgent and uncertain stock before safe stock without changing source data', () => {
    const source = [
      { id: 'safe', stockHealth: 'aman' },
      { id: 'low', stockHealth: 'tipis' },
      { id: 'unknown', stockHealth: 'perlu-cocokkan' },
      { id: 'out', stockHealth: 'habis' },
    ];
    expect(sortStockAttentionFirst(source).map(item => item.id)).toEqual(['out', 'low', 'unknown', 'safe']);
    expect(source.map(item => item.id)).toEqual(['safe', 'low', 'unknown', 'out']);
  });

  it('keeps the products page product-first before revealing HPP or channel detail', () => {
    expect(productPrimaryMode({ productCount: 0, canManage: true })).toBe('add-product');
    expect(productPrimaryMode({ productCount: 3, canManage: true })).toBe('browse');
    expect(productPrimaryMode({ productCount: 0, canManage: false })).toBe('view-only');
  });

  it('shows settlement only to finance roles when a relevant enabled channel exists', () => {
    expect(shouldShowSettlementWorkspace({ canViewFinance: true, enabledChannelCount: 1 })).toBe(true);
    expect(shouldShowSettlementWorkspace({ canViewFinance: true, enabledChannelCount: 0 })).toBe(false);
    expect(shouldShowSettlementWorkspace({ canViewFinance: false, enabledChannelCount: 2 })).toBe(false);
  });

  it('never declares channel pricing ready without a real recorded price and HPP', () => {
    expect(channelSimulationReadiness({ recordedPrice: null, hpp: null, canViewCosting: true })).toBe('missing-price');
    expect(channelSimulationReadiness({ recordedPrice: 15000, hpp: null, canViewCosting: true })).toBe('missing-hpp');
    expect(channelSimulationReadiness({ recordedPrice: 15000, hpp: 8000, canViewCosting: true })).toBe('ready');
    expect(channelSimulationReadiness({ recordedPrice: 15000, hpp: 8000, canViewCosting: false })).toBe('price-only');
  });
});
