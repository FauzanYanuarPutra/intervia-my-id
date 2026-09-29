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
  sourceContactUrl: string;
  sourceContactType: 'whatsapp' | 'source';
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

function normalizeWhatsAppNumber(value: unknown): string {
  const raw = readText(value);
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('00')) return digits.slice(2).slice(0, 15);
  if (digits.startsWith('62')) return digits.slice(0, 15);
  if (digits.startsWith('0')) return `62${digits.slice(1)}`.slice(0, 15);
  if (digits.startsWith('8')) return `62${digits}`.slice(0, 15);
  return digits.slice(0, 15);
}

function sourceWhatsAppUrl(metadata: JsonRecord): string {
  const contact = asRecord(metadata.contact);
  const explicit = [
    metadata.whatsapp_url,
    metadata.whatsappUrl,
    metadata.whatsapp,
    metadata.whatsapp_number,
    metadata.whatsapp_phone,
    metadata.contact_whatsapp,
    contact.whatsapp_url,
    contact.whatsappUrl,
    contact.whatsapp,
    contact.whatsapp_number,
    contact.whatsapp_phone,
  ].find(value => {
    const url = safeExternalUrl(value);
    return /(?:wa\.me|whatsapp\.com)/i.test(url);
  });
  const explicitUrl = safeExternalUrl(explicit);
  if (explicitUrl) return explicitUrl;

  const phone = normalizeWhatsAppNumber(
    [
      metadata.phone,
      metadata.phone_number,
      metadata.phoneNumber,
      metadata.contact_phone,
      metadata.contactPhone,
      contact.phone,
      contact.phone_number,
      contact.phoneNumber,
    ].find(value => readText(value)),
  );
  return phone.length >= 8 ? `https://wa.me/${phone}` : '';
}

function resolveSourceContact(metadata: JsonRecord): {
  url: string;
  type: 'whatsapp' | 'source';
} {
  const whatsapp = sourceWhatsAppUrl(metadata);
  if (whatsapp) {
    return { url: whatsapp, type: 'whatsapp' };
  }

  const contact = asRecord(metadata.contact);
  const directContact = [
    metadata.contact_url,
    metadata.contactUrl,
    contact.url,
  ]
    .map(safeExternalUrl)
    .find(Boolean);
  if (directContact) {
    return { url: directContact, type: 'source' };
  }

  return {
    url: '',
    type: 'source',
  };
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
  const sourceContact = resolveSourceContact(metadata);

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
    sourceContactUrl: sourceContact.url,
    sourceContactType: sourceContact.type,
  };
}
