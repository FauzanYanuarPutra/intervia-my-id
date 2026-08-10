import type { ContentItem } from '@/lib/content/catalog';

type JsonRecord = Record<string, unknown>;

export type PublicReferenceInfo = {
  recordKind: string;
  sourceTitle: string;
  sourceUrl: string;
  sourceLicense: string;
  sourceLicenseUrl: string;
  trustNote: string;
  imageAttribution: string;
  imageSourceUrl: string;
  imageLicense: string;
  imageLicenseUrl: string;
};

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function readText(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function safeExternalUrl(value: unknown): string {
  const raw = readText(value);
  if (!raw) return '';
  try {
    const url = new URL(raw);
    return (url.protocol === 'https:' || url.protocol === 'http:') &&
      !url.username &&
      !url.password
      ? url.toString()
      : '';
  } catch {
    return '';
  }
}

export function isExplicitlyNonTransactional(item: ContentItem): boolean {
  const value = item.metadata?.is_transactional;
  return value === false || String(value).trim().toLowerCase() === 'false';
}

export function isPublicReferenceMetadata(value: unknown): boolean {
  const metadata = asRecord(value);
  const recordKind = readText(metadata.record_kind).toLowerCase();
  const marketSide = readText(
    metadata.market_side,
    metadata.listing_side,
  ).toLowerCase();
  const transactional = metadata.is_transactional;
  const explicitlyNonTransactional =
    transactional === false ||
    String(transactional).trim().toLowerCase() === 'false';

  return (
    recordKind.includes('reference') &&
    (explicitlyNonTransactional || marketSide === 'reference')
  );
}

export function readPublicReference(
  item: ContentItem,
): PublicReferenceInfo | null {
  const metadata = asRecord(item.metadata);
  const recordKind = readText(metadata.record_kind).toLowerCase();
  if (
    !isExplicitlyNonTransactional(item) ||
    !isPublicReferenceMetadata(metadata)
  ) {
    return null;
  }

  const source = asRecord(metadata.source);
  const imageCredit = asRecord(metadata.image_credit);
  const sourceUrl = safeExternalUrl(source.url || metadata.source_url);
  if (!sourceUrl) return null;

  const provider = readText(
    imageCredit.provider,
    metadata.media_provider,
    source.title,
  );
  const author = readText(imageCredit.author, metadata.media_author);
  const imageLicense = readText(
    imageCredit.license,
    imageCredit.license_name,
    metadata.media_license_name,
  );

  return {
    recordKind,
    sourceTitle: readText(source.title, metadata.source_title),
    sourceUrl,
    sourceLicense: readText(source.license, metadata.source_license),
    sourceLicenseUrl: safeExternalUrl(
      source.license_url || metadata.source_license_url,
    ),
    trustNote: readText(metadata.trust_note),
    imageAttribution: [provider, author, imageLicense]
      .filter(Boolean)
      .join(' · '),
    imageSourceUrl: safeExternalUrl(
      imageCredit.source_url || imageCredit.original_url,
    ),
    imageLicense,
    imageLicenseUrl: safeExternalUrl(imageCredit.license_url),
  };
}
