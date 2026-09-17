import { calculateChannelMargin, recommendChannelPrice } from './costing';

export function buildChannelBusinessSummary(input: {
  price: number | null;
  hpp: number | null;
  feePercent: number;
  fixedFee: number;
  merchantPromo: number;
  targetMarginPercent: number;
}) {
  if (input.price === null || input.hpp === null) {
    return {
      ready: false as const,
      netReceipt: null,
      contributionProfit: null,
      recommendedPrice: null,
    };
  }

  const margin = calculateChannelMargin({
    price: input.price,
    hpp: input.hpp,
    feeRatePercent: input.feePercent,
    fixedFee: input.fixedFee,
    merchantPromo: input.merchantPromo,
  });
  const recommendation = recommendChannelPrice({
    hpp: input.hpp,
    deductionRatePercent: input.feePercent,
    fixedFee: input.fixedFee + input.merchantPromo,
    targetMarginPercent: input.targetMarginPercent,
    roundTo: 500,
  });

  return {
    ready: true as const,
    netReceipt: margin.netRevenue,
    contributionProfit: margin.contributionProfit,
    recommendedPrice: recommendation.valid ? recommendation.recommendedPrice : null,
  };
}
