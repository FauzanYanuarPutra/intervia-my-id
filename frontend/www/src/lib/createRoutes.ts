import type { ListingSide } from '@/lib/content/listingSide';

export type CreateFlowIntent = 'demand' | 'supply';
export type CreateRouteTypeId =
  | 'product'
  | 'service'
  | 'job'
  | 'property'
  | 'tool_rental'
  | 'company';

const CREATE_FLOW_SEGMENTS: Record<
  CreateFlowIntent,
  { id: string; en: string; aliases: string[] }
> = {
  demand: {
    id: 'butuh',
    en: 'need',
    aliases: ['butuh', 'need', 'demand', 'brief'],
  },
  supply: {
    id: 'jual',
    en: 'sell',
    aliases: ['jual', 'sell', 'supply', 'listing'],
  },
};

const CREATE_TYPE_SEGMENTS: Record<
  CreateRouteTypeId,
  { id: string; en: string; aliases: string[] }
> = {
  product: {
    id: 'produk',
    en: 'products',
    aliases: ['produk', 'product', 'products'],
  },
  service: {
    id: 'jasa',
    en: 'services',
    aliases: ['jasa', 'service', 'services'],
  },
  job: {
    id: 'lowongan',
    en: 'jobs',
    aliases: ['lowongan', 'job', 'jobs', 'hiring'],
  },
  property: {
    id: 'properti',
    en: 'property',
    aliases: ['properti', 'property', 'properties'],
  },
  tool_rental: {
    id: 'sewa-alat',
    en: 'tool-rental',
    aliases: ['sewa-alat', 'tool-rental', 'tool_rental', 'rental'],
  },
  company: {
    id: 'profil-usaha',
    en: 'business-profile',
    aliases: ['profil-usaha', 'business-profile', 'company', 'company-profile'],
  },
};

function cleanRouteToken(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function resolveCreateFlowFromSide(
  side: ListingSide | null | undefined,
): CreateFlowIntent | null {
  if (side === 'demand') return 'demand';
  if (side === 'supply') return 'supply';
  return null;
}

export function normalizeCreateFlowSegment(
  value: string | null | undefined,
): CreateFlowIntent | null {
  const normalized = cleanRouteToken(value);
  if (!normalized) return null;
  for (const [intent, config] of Object.entries(CREATE_FLOW_SEGMENTS)) {
    if (config.aliases.includes(normalized)) {
      return intent as CreateFlowIntent;
    }
  }
  return null;
}

export function normalizeCreateTypeSegment(
  value: string | null | undefined,
): CreateRouteTypeId | '' {
  const normalized = cleanRouteToken(value);
  if (!normalized) return '';
  for (const [typeId, config] of Object.entries(CREATE_TYPE_SEGMENTS)) {
    if (config.aliases.includes(normalized)) {
      return typeId as CreateRouteTypeId;
    }
  }
  return '';
}

export function buildCreatePath({
  locale,
  side,
  type,
}: {
  locale: string;
  side?: ListingSide | null;
  type?: string | null;
}): string {
  const flow = resolveCreateFlowFromSide(side);
  if (!flow) return '/create';

  const flowSegment =
    locale === 'en' ? CREATE_FLOW_SEGMENTS[flow].en : CREATE_FLOW_SEGMENTS[flow].id;
  const normalizedType = cleanRouteToken(type);
  if (
    normalizedType &&
    Object.prototype.hasOwnProperty.call(CREATE_TYPE_SEGMENTS, normalizedType)
  ) {
    const typed = normalizedType as CreateRouteTypeId;
    const typeSegment =
      locale === 'en'
        ? CREATE_TYPE_SEGMENTS[typed].en
        : CREATE_TYPE_SEGMENTS[typed].id;
    return `/create/${flowSegment}/${typeSegment}`;
  }

  return `/create/${flowSegment}`;
}

export function resolveMarketplaceCreatePath(
  locale: string,
  type: string,
  listingSide: ListingSide = 'demand',
): string {
  const normalizedType = cleanRouteToken(type);
  if (
    normalizedType === 'umkm' ||
    normalizedType === 'business' ||
    normalizedType === 'company'
  ) {
    return '/usaha/onboarding';
  }
  if (
    normalizedType === 'freelancer' ||
    normalizedType === 'talent' ||
    normalizedType === 'user' ||
    normalizedType === 'users' ||
    normalizedType === 'profile'
  ) {
    return listingSide === 'supply'
      ? '/profile/edit?focus=talent'
      : buildCreatePath({ locale, side: 'demand', type: 'job' });
  }
  if (normalizedType === 'job') {
    return buildCreatePath({ locale, side: 'demand', type: 'job' });
  }
  if (
    normalizedType === 'product' ||
    normalizedType === 'service' ||
    normalizedType === 'property' ||
    normalizedType === 'tool_rental'
  ) {
    return buildCreatePath({
      locale,
      side: listingSide,
      type: normalizedType,
    });
  }
  return '/create';
}
