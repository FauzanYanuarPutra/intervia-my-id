export type PromotionOfferType =
  | 'discount'
  | 'bundle'
  | 'free_shipping'
  | 'bonus'
  | 'referral'
  | 'loyalty_card'
  | 'raffle';

export type PromotionGuardrailStatus = 'safe' | 'watch' | 'unsafe' | 'unknown';

type PromotionRecord = Record<string, unknown>;

export type PromotionSnapshot = {
  offerType: PromotionOfferType | null;
  offerLabel: string;
  offerTagline: string;
  benefitLabel: string;
  supportLabel: string;
  promoLabel: string;
  startAt?: string;
  endAt?: string;
  estimatedBenefitCents?: number;
  safeCapCents?: number;
  estimatedOriginalPriceCents?: number;
  reservePercent: number;
  marginPercent?: number;
  bufferPercent?: number;
  status: PromotionGuardrailStatus;
  financialMessage: string;
};

const PRIMARY_PROMOTION_OFFERS = new Set<PromotionOfferType>([
  'discount',
  'loyalty_card',
  'raffle',
]);

const ALL_PROMOTION_OFFERS = new Set<PromotionOfferType>([
  'discount',
  'bundle',
  'free_shipping',
  'bonus',
  'referral',
  'loyalty_card',
  'raffle',
]);

export const DEFAULT_PROMOTION_PLATFORM_FEE_PERCENT = 3;
export const DEFAULT_PROMOTION_TAX_PERCENT = 11;
export const DEFAULT_PROMOTION_OPEX_PERCENT = 2;

function asText(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return undefined;
  const cleaned = value.trim().replace(/,/g, '.').replace(/[^\d.-]/g, '');
  if (!cleaned) return undefined;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function asWholeMoney(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.round(value);
  }
  if (typeof value !== 'string') return undefined;
  const digits = value.replace(/\D/g, '');
  if (!digits) return undefined;
  const parsed = Number(digits);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function toMoneyCents(value: unknown): number | undefined {
  const wholeMoney = asWholeMoney(value);
  return wholeMoney && wholeMoney > 0 ? wholeMoney * 100 : undefined;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function formatCurrency(cents: number, locale: 'id' | 'en'): string {
  if (!Number.isFinite(cents) || cents <= 0) {
    return locale === 'id' ? 'Rp0' : 'IDR 0';
  }
  return new Intl.NumberFormat(locale === 'id' ? 'id-ID' : 'en-US', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Math.max(0, cents) / 100);
}

function normalizeDateToIso(
  value: unknown,
  boundary: 'start' | 'end',
): string | undefined {
  const text = asText(value);
  if (!text) return undefined;

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return boundary === 'start'
      ? `${text}T00:00:00.000Z`
      : `${text}T23:59:59.999Z`;
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString();
}

function normalizeDiscountKind(value: unknown): 'percent' | 'flat' | 'shipping' {
  const normalized = asText(value).toLowerCase();
  if (normalized === 'percent') return 'percent';
  if (normalized === 'shipping' || normalized === 'free_shipping') {
    return 'shipping';
  }
  return 'flat';
}

function getOfferMeta(
  offerType: PromotionOfferType | null,
  locale: 'id' | 'en',
): { label: string; tagline: string; support: string } {
  switch (offerType) {
    case 'discount':
      return {
        label: locale === 'id' ? 'Diskon langsung' : 'Instant discount',
        tagline:
          locale === 'id'
            ? 'Paling cepat menaikkan klik dan checkout.'
            : 'The fastest path to more clicks and checkout.',
        support:
          locale === 'id'
            ? 'Cocok untuk stok cepat jalan dan promosi pendek.'
            : 'Best for fast-moving stock and short campaigns.',
      };
    case 'loyalty_card':
      return {
        label: locale === 'id' ? 'Kartu loyalti' : 'Loyalty card',
        tagline:
          locale === 'id'
            ? 'Dorong repeat order tanpa diskon ke semua orang.'
            : 'Drives repeat orders without discounting everyone.',
        support:
          locale === 'id'
            ? 'Lebih sehat untuk margin karena reward dibuka bertahap.'
            : 'Healthier for margin because rewards unlock gradually.',
      };
    case 'raffle':
      return {
        label: locale === 'id' ? 'Raffle hadiah' : 'Prize raffle',
        tagline:
          locale === 'id'
            ? 'Terasa seru dan ramai, tetapi biaya tetap bisa dibatasi.'
            : 'Feels exciting while keeping costs bounded.',
        support:
          locale === 'id'
            ? 'Bagus untuk campaign periodik dan dorong share.'
            : 'Useful for campaign bursts and sharing momentum.',
      };
    case 'bundle':
      return {
        label: locale === 'id' ? 'Bundle' : 'Bundle',
        tagline:
          locale === 'id'
            ? 'Naikkan nilai order dengan paket.'
            : 'Lift basket size with packaged offers.',
        support:
          locale === 'id'
            ? 'Cocok untuk upsell dan cross-sell.'
            : 'Good for upsell and cross-sell motions.',
      };
    case 'free_shipping':
      return {
        label: locale === 'id' ? 'Gratis ongkir' : 'Free shipping',
        tagline:
          locale === 'id'
            ? 'Hilangkan friksi checkout paling umum.'
            : 'Removes a common checkout friction.',
        support:
          locale === 'id'
            ? 'Gunakan dengan batas nilai dan area.'
            : 'Use with value and area limits.',
      };
    case 'bonus':
      return {
        label: locale === 'id' ? 'Bonus' : 'Bonus',
        tagline:
          locale === 'id'
            ? 'Tambah value tanpa ubah harga utama.'
            : 'Adds value without changing the main price.',
        support:
          locale === 'id'
            ? 'Aman untuk produk dengan bonus murah.'
            : 'Good for items with low-cost bonuses.',
      };
    case 'referral':
      return {
        label: locale === 'id' ? 'Referral' : 'Referral',
        tagline:
          locale === 'id'
            ? 'Pakai pelanggan lama untuk bawa pelanggan baru.'
            : 'Use existing customers to bring in new ones.',
        support:
          locale === 'id'
            ? 'Lebih efisien kalau reward hanya keluar saat sukses.'
            : 'More efficient when rewards only unlock on success.',
      };
    default:
      return {
        label: locale === 'id' ? 'Benefit program' : 'Benefit program',
        tagline:
          locale === 'id'
            ? 'Tambahkan benefit yang terasa ke pembeli.'
            : 'Add a customer-facing benefit.',
        support:
          locale === 'id'
            ? 'Sesuaikan dengan ritme margin dan operasi.'
            : 'Adjust it to your margin and operations.',
      };
  }
}

export function normalizePromotionOfferType(
  value: unknown,
): PromotionOfferType | null {
  const normalized = asText(value).toLowerCase() as PromotionOfferType;
  return ALL_PROMOTION_OFFERS.has(normalized) ? normalized : null;
}

export function isPrimaryPromotionOfferType(value: unknown): boolean {
  const offerType = normalizePromotionOfferType(value);
  return offerType ? PRIMARY_PROMOTION_OFFERS.has(offerType) : false;
}

function estimateDiscountBenefitCents(
  promotion: PromotionRecord,
  priceCents?: number | null,
): { benefitCents?: number; originalPriceCents?: number; label?: string } {
  const discountKind = normalizeDiscountKind(promotion.promo_discount_kind);
  if (discountKind === 'percent') {
    const percent = clamp(asNumber(promotion.promo_discount_percent) || 0, 0, 90);
    if (!priceCents || percent <= 0) {
      return {
        label: percent > 0 ? `${percent}%` : undefined,
      };
    }
    const originalPriceCents = Math.round(priceCents / (1 - percent / 100));
    return {
      benefitCents: Math.max(0, originalPriceCents - priceCents),
      originalPriceCents,
      label: `${percent}%`,
    };
  }

  const amountCents = toMoneyCents(promotion.promo_discount_amount);
  if (!amountCents || amountCents <= 0) {
    return {
      label: undefined,
    };
  }

  return {
    benefitCents: amountCents,
    originalPriceCents: discountKind === 'flat' && priceCents ? priceCents + amountCents : undefined,
    label: amountCents > 0 ? amountCents.toString() : undefined,
  };
}

function estimateLoyaltyBenefitCents(promotion: PromotionRecord): number | undefined {
  const stampTarget = clamp(
    Math.round(asNumber(promotion.promo_loyalty_stamp_target) || 0),
    0,
    1000,
  );
  const rewardValueCents = toMoneyCents(promotion.promo_loyalty_reward_value);
  if (!stampTarget || !rewardValueCents) return undefined;
  return Math.round(rewardValueCents / stampTarget);
}

function estimateRaffleBenefitCents(promotion: PromotionRecord): number | undefined {
  const prizeValueCents = toMoneyCents(promotion.promo_raffle_prize_value);
  const expectedEntries = clamp(
    Math.round(asNumber(promotion.promo_raffle_expected_entries) || 0),
    0,
    1_000_000,
  );
  const winners = clamp(
    Math.round(asNumber(promotion.promo_raffle_max_winners) || 1),
    1,
    10_000,
  );
  if (!prizeValueCents || !expectedEntries) return undefined;
  return Math.round((prizeValueCents * winners) / expectedEntries);
}

function buildBenefitLabel(
  offerType: PromotionOfferType | null,
  promotion: PromotionRecord,
  estimatedBenefitCents: number | undefined,
  locale: 'id' | 'en',
): string {
  if (offerType === 'discount') {
    const discountKind = normalizeDiscountKind(promotion.promo_discount_kind);
    if (discountKind === 'percent') {
      const percent = clamp(asNumber(promotion.promo_discount_percent) || 0, 0, 90);
      return percent > 0
        ? locale === 'id'
          ? `Diskon ${percent}%`
          : `${percent}% off`
        : getOfferMeta(offerType, locale).label;
    }
    if (estimatedBenefitCents) {
      return discountKind === 'shipping'
        ? locale === 'id'
          ? `Gratis ongkir s.d. ${formatCurrency(estimatedBenefitCents, locale)}`
          : `Shipping covered up to ${formatCurrency(estimatedBenefitCents, locale)}`
        : locale === 'id'
          ? `Potongan ${formatCurrency(estimatedBenefitCents, locale)}`
          : `${formatCurrency(estimatedBenefitCents, locale)} off`;
    }
  }

  if (offerType === 'loyalty_card') {
    const stampTarget = clamp(
      Math.round(asNumber(promotion.promo_loyalty_stamp_target) || 0),
      0,
      1000,
    );
    const rewardValueCents = toMoneyCents(promotion.promo_loyalty_reward_value);
    if (stampTarget > 0 && rewardValueCents) {
      return locale === 'id'
        ? `${stampTarget} stamp = ${formatCurrency(rewardValueCents, locale)}`
        : `${stampTarget} stamps = ${formatCurrency(rewardValueCents, locale)}`;
    }
  }

  if (offerType === 'raffle') {
    const title = asText(promotion.promo_raffle_prize_title);
    if (title) {
      return locale === 'id' ? `Raffle ${title}` : `Raffle ${title}`;
    }
  }

  const fallbackValue = asText(promotion.promo_offer_value);
  return fallbackValue || getOfferMeta(offerType, locale).label;
}

function buildFinancialMessage(
  status: PromotionGuardrailStatus,
  locale: 'id' | 'en',
): string {
  switch (status) {
    case 'safe':
      return locale === 'id'
        ? 'Benefit masih di bawah buffer margin setelah fee, PPN, dan opex.'
        : 'Benefit stays under the margin buffer after fees, tax, and opex.';
    case 'watch':
      return locale === 'id'
        ? 'Masih bisa jalan, tetapi buffer sudah tipis. Pantau redeem dan biaya aktual.'
        : 'This can still run, but the buffer is getting thin. Watch redemptions and actual costs.';
    case 'unsafe':
      return locale === 'id'
        ? 'Benefit melewati buffer aman. Kecilkan benefit atau naikkan harga/margin.'
        : 'The benefit exceeds the safe buffer. Reduce the offer or improve price/margin.';
    default:
      return locale === 'id'
        ? 'Isi harga dan margin agar sistem bisa cek apakah promo masih aman.'
        : 'Add price and margin so the system can verify if the promo is safe.';
  }
}

export function createPromotionSnapshot(
  promotionLike: unknown,
  priceCents?: number | null,
  locale: 'id' | 'en' = 'id',
): PromotionSnapshot | null {
  if (!promotionLike || typeof promotionLike !== 'object' || Array.isArray(promotionLike)) {
    return null;
  }

  const promotion = promotionLike as PromotionRecord;
  const offerType = normalizePromotionOfferType(promotion.promo_offer_type);
  const meta = getOfferMeta(offerType, locale);

  let estimatedBenefitCents: number | undefined;
  let estimatedOriginalPriceCents: number | undefined;
  if (offerType === 'discount') {
    const discountEstimate = estimateDiscountBenefitCents(promotion, priceCents);
    estimatedBenefitCents = discountEstimate.benefitCents;
    estimatedOriginalPriceCents = discountEstimate.originalPriceCents;
  } else if (offerType === 'loyalty_card') {
    estimatedBenefitCents = estimateLoyaltyBenefitCents(promotion);
  } else if (offerType === 'raffle') {
    estimatedBenefitCents = estimateRaffleBenefitCents(promotion);
  }

  const marginPercent = clamp(asNumber(promotion.promo_estimated_margin_percent) || 0, 0, 95);
  const feePercent = clamp(
    asNumber(promotion.promo_platform_fee_percent) ??
      DEFAULT_PROMOTION_PLATFORM_FEE_PERCENT,
    0,
    40,
  );
  const taxPercent = clamp(
    asNumber(promotion.promo_tax_percent) ?? DEFAULT_PROMOTION_TAX_PERCENT,
    0,
    40,
  );
  const opexPercent = clamp(
    asNumber(promotion.promo_opex_percent) ?? DEFAULT_PROMOTION_OPEX_PERCENT,
    0,
    40,
  );
  const reservePercent = feePercent + taxPercent + opexPercent;
  const bufferPercent = Math.max(0, marginPercent - reservePercent);
  const safeCapCents =
    priceCents && priceCents > 0 && bufferPercent > 0
      ? Math.round(priceCents * (bufferPercent / 100))
      : undefined;

  let status: PromotionGuardrailStatus = 'unknown';
  if (safeCapCents && estimatedBenefitCents && estimatedBenefitCents > 0) {
    if (estimatedBenefitCents <= safeCapCents * 0.7) {
      status = 'safe';
    } else if (estimatedBenefitCents <= safeCapCents) {
      status = 'watch';
    } else {
      status = 'unsafe';
    }
  } else if (
    offerType &&
    !PRIMARY_PROMOTION_OFFERS.has(offerType) &&
    asText(promotion.promo_offer_value)
  ) {
    status = 'watch';
  }

  const benefitLabel = buildBenefitLabel(
    offerType,
    promotion,
    estimatedBenefitCents,
    locale,
  );

  return {
    offerType,
    offerLabel: meta.label,
    offerTagline: meta.tagline,
    benefitLabel,
    supportLabel: meta.support,
    promoLabel: benefitLabel,
    startAt: normalizeDateToIso(promotion.promo_start_date, 'start'),
    endAt: normalizeDateToIso(promotion.promo_end_date, 'end'),
    estimatedBenefitCents,
    safeCapCents,
    estimatedOriginalPriceCents,
    reservePercent,
    marginPercent: marginPercent > 0 ? marginPercent : undefined,
    bufferPercent: bufferPercent > 0 ? bufferPercent : undefined,
    status,
    financialMessage: buildFinancialMessage(status, locale),
  };
}

export function derivePromotionTopLevelFields(input: {
  promotionLike: unknown;
  priceCents?: number | null;
  locale?: 'id' | 'en';
}): {
  promoLabel?: string;
  promoStartAt?: string;
  promoEndAt?: string;
  originalPriceCents?: number;
} {
  const snapshot = createPromotionSnapshot(
    input.promotionLike,
    input.priceCents,
    input.locale || 'id',
  );
  if (!snapshot) {
    return {};
  }

  return {
    promoLabel: snapshot.promoLabel || undefined,
    promoStartAt: snapshot.startAt,
    promoEndAt: snapshot.endAt,
    originalPriceCents: snapshot.estimatedOriginalPriceCents,
  };
}
