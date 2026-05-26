export type LajukanSummary = {
  categories: {
    all: number;
    supplier: number;
    location: number;
    service: number;
    product: number;
    talent: number;
  };
  requests: {
    total: number;
    active: number;
    waiting: number;
    completed: number;
  };
  stores: {
    total: number;
    cities: number;
    verified: number;
  };
};

export type LajukanRequestDetail = {
  category: string;
  need_type: string;
  amount_label: string;
  deadline_label: string;
  budget_label: string;
  description: string;
  location_label: string;
  extra_label: string;
};

export type LajukanOfferPreview = {
  id: string;
  vendor: string;
  rating_label: string;
  review_label: string;
  price_label: string;
  delivery_label: string;
  guarantee_label: string;
  note: string;
  status: string;
  updated_at: string;
};

export type LajukanRequestCard = {
  id: string;
  slug?: string | null;
  title: string;
  city: string;
  created_at: string;
  created_label: string;
  offers_label: string;
  offer_count: number;
  cover_image?: string | null;
  image_urls?: string[];
  status: string;
  status_key: 'active' | 'waiting' | 'completed' | string;
  detail: LajukanRequestDetail;
  offers: LajukanOfferPreview[];
};

export type LajukanRequestsPayload = {
  active: LajukanRequestCard[];
  completed: LajukanRequestCard[];
  counts: {
    total: number;
    active: number;
    waiting: number;
    completed: number;
  };
};

export function formatLajukanCountLabel(value?: number | null): string {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return '...';
  }

  return new Intl.NumberFormat('id-ID').format(value);
}

export function formatLajukanCountWithSuffix(
  value: number | null | undefined,
  suffix: string,
): string {
  const formatted = formatLajukanCountLabel(value);
  return formatted === '...' ? formatted : `${formatted} ${suffix}`.trim();
}
