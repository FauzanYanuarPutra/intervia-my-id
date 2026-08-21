import type { UmkmPlaceKind } from './umkm-place-ui';

export type UmkmDiscoveryCategory =
  | 'all'
  | 'food'
  | 'retail'
  | 'service'
  | 'property'
  | 'workshop';

type DiscoveryCategoryCandidate = {
  kind: UmkmPlaceKind;
  name: string;
  description?: string | null;
  address?: string | null;
  metadata?: Record<string, unknown> | null;
};

function readMetadataText(
  metadata: Record<string, unknown> | null | undefined,
  keys: string[],
) {
  if (!metadata) return '';
  return keys
    .map(key => metadata[key])
    .filter((value): value is string => typeof value === 'string')
    .map(value => value.trim())
    .filter(Boolean)
    .join(' ');
}

export function matchesUmkmDiscoveryCategory(
  candidate: DiscoveryCategoryCandidate,
  category: string | undefined,
): boolean {
  if (!category || category === 'all') return true;
  if (category === 'food') return candidate.kind === 'food';
  if (category === 'retail') return candidate.kind === 'retail';
  if (category === 'service') return candidate.kind === 'service';
  if (category === 'workshop') return candidate.kind === 'workshop';
  if (category !== 'property') return true;

  const propertyHint = [
    candidate.name,
    candidate.description || '',
    candidate.address || '',
    readMetadataText(candidate.metadata, [
      'umkm_category',
      'business_type',
      'store_type',
      'segment',
      'category',
      'category_label',
    ]),
  ]
    .join(' ')
    .toLowerCase();

  return /(ruko|kios|booth|tempat\s*usaha|lokasi\s*usaha|sewa\s*tempat)/i.test(
    propertyHint,
  );
}
