import { describe, expect, it } from 'vitest';
import {
  createPromotionSnapshot,
  derivePromotionTopLevelFields,
  isPrimaryPromotionOfferType,
} from './promotionPrograms';

describe('promotionPrograms', () => {
  it('computes a safe discount snapshot and derives display pricing fields', () => {
    const promotion = {
      promo_offer_type: 'discount',
      promo_discount_kind: 'percent',
      promo_discount_percent: 10,
      promo_estimated_margin_percent: 30,
      promo_platform_fee_percent: 3,
      promo_tax_percent: 11,
      promo_opex_percent: 2,
      promo_start_date: '2026-03-20',
      promo_end_date: '2026-03-31',
    };

    const snapshot = createPromotionSnapshot(promotion, 90_000 * 100, 'id');

    expect(snapshot).not.toBeNull();
    expect(snapshot?.offerType).toBe('discount');
    expect(snapshot?.status).toBe('watch');
    expect(snapshot?.estimatedBenefitCents).toBe(1_000_000);

    expect(
      derivePromotionTopLevelFields({
        promotionLike: promotion,
        priceCents: 90_000 * 100,
        locale: 'id',
      }),
    ).toEqual({
      promoLabel: 'Diskon 10%',
      promoStartAt: '2026-03-20T00:00:00.000Z',
      promoEndAt: '2026-03-31T23:59:59.999Z',
      originalPriceCents: 10_000_000,
    });
  });

  it('flags unsafe raffles when expected prize burn exceeds the safe cap', () => {
    const snapshot = createPromotionSnapshot(
      {
        promo_offer_type: 'raffle',
        promo_raffle_prize_title: 'Voucher belanja',
        promo_raffle_prize_value: 500000,
        promo_raffle_expected_entries: 20,
        promo_raffle_max_winners: 2,
        promo_estimated_margin_percent: 18,
      },
      100_000 * 100,
      'id',
    );

    expect(snapshot?.offerType).toBe('raffle');
    expect(snapshot?.estimatedBenefitCents).toBe(5_000_000);
    expect(snapshot?.status).toBe('unsafe');
  });

  it('treats loyalty cards as primary promotion offers', () => {
    expect(isPrimaryPromotionOfferType('loyalty_card')).toBe(true);
    expect(isPrimaryPromotionOfferType('bundle')).toBe(false);
  });
});
