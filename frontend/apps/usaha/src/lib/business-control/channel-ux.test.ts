import { describe, expect, it } from 'vitest';
import { calculateChannelMargin } from './costing';
import { buildChannelBusinessSummary } from './channel-ux';

describe('channel business summary', () => {
  it('maps shared costing results to merchant-facing values', () => {
    const input = {
      price: 20_000,
      hpp: 8_000,
      feePercent: 20,
      fixedFee: 1_000,
      merchantPromo: 1_000,
      targetMarginPercent: 25,
    };
    const canonical = calculateChannelMargin({
      price: input.price,
      hpp: input.hpp,
      feeRatePercent: input.feePercent,
      fixedFee: input.fixedFee,
      merchantPromo: input.merchantPromo,
    });

    const result = buildChannelBusinessSummary(input);

    expect(result.ready).toBe(true);
    expect(result.netReceipt).toBe(canonical.netRevenue);
    expect(result.contributionProfit).toBe(canonical.contributionProfit);
    expect(result.recommendedPrice).toBeTypeOf('number');
  });

  it('does not invent profit when price or HPP is unavailable', () => {
    expect(buildChannelBusinessSummary({
      price: 20_000,
      hpp: null,
      feePercent: 20,
      fixedFee: 0,
      merchantPromo: 0,
      targetMarginPercent: 25,
    })).toEqual({
      ready: false,
      netReceipt: null,
      contributionProfit: null,
      recommendedPrice: null,
    });
  });
});
