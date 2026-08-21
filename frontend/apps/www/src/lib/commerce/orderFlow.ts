export type PricingMode = 'fixed' | 'request';
export type ListingKind = 'job' | 'service' | 'marketplace' | 'property' | 'talent' | 'other';

export type DiscountSummary = {
  hasDiscount: boolean;
  discountPercent?: number;
  finalPriceCents?: number;
  originalPriceCents?: number;
  savingsCents?: number;
};

export type StructuredChatPayload = Record<string, unknown>;

function toPositiveInteger(value: unknown): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.floor(parsed);
}

export function buildDiscountSummary(input: {
  pricingMode: PricingMode;
  finalPriceCents?: unknown;
  originalPriceCents?: unknown;
}): DiscountSummary {
  if (input.pricingMode !== 'fixed') {
    return { hasDiscount: false };
  }

  const finalPrice = toPositiveInteger(input.finalPriceCents);
  const originalPrice = toPositiveInteger(input.originalPriceCents);
  if (!finalPrice || !originalPrice || originalPrice <= finalPrice) {
    return {
      hasDiscount: false,
      finalPriceCents: finalPrice || undefined,
      originalPriceCents: originalPrice || undefined,
    };
  }

  const savings = originalPrice - finalPrice;
  const discountPercent = Math.round((savings / originalPrice) * 100);
  return {
    hasDiscount: true,
    discountPercent,
    finalPriceCents: finalPrice,
    originalPriceCents: originalPrice,
    savingsCents: savings,
  };
}

export function resolveListingCtas(pricingMode: PricingMode, kind: ListingKind): string[] {
  if (kind === 'job') {
    return pricingMode === 'request' ? ['Tanya Detail', 'Chat'] : ['Lamar', 'Tawar', 'Chat'];
  }
  if (kind === 'talent') {
    return pricingMode === 'request' ? ['Tanya Rate', 'Chat'] : ['Hire', 'Tawar', 'Chat'];
  }
  return pricingMode === 'request' ? ['Tanya Harga', 'Chat'] : ['Beli', 'Tawar', 'Chat'];
}

export function parseRichCardPayload(raw?: string | null): StructuredChatPayload | null {
  if (!raw) return null;
  const text = raw.trim();
  if (!text || !(text.startsWith('{') || text.startsWith('['))) return null;
  try {
    const parsed = JSON.parse(text) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as StructuredChatPayload;
    }
  } catch {
    return null;
  }
  return null;
}

export function inferPricingModeFromPayload(meta: StructuredChatPayload): PricingMode {
  const mode = typeof meta.pricing_mode === 'string' ? meta.pricing_mode.trim().toLowerCase() : '';
  if (mode === 'request') return 'request';
  if (mode === 'fixed') return 'fixed';
  const price = Number(meta.price_cents ?? 0);
  return Number.isFinite(price) && price > 0 ? 'fixed' : 'request';
}
