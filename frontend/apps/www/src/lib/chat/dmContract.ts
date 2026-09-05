export type DmLeadInput = Record<string, unknown>;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PUBLIC_METADATA_KEYS = [
  'listing_side',
  'market_side',
  'fulfillment_mode',
  'content_type',
  'category',
  'source_surface',
] as const;

export function isUuidLike(value: string | null | undefined): boolean {
  return typeof value === 'string' && UUID_PATTERN.test(value.trim());
}

export function isSelfDm(
  currentUserId: string | null | undefined,
  peerUserId: string | null | undefined,
): boolean {
  const current = currentUserId?.trim().toLowerCase();
  const peer = peerUserId?.trim().toLowerCase();
  return Boolean(current && peer && current === peer);
}

function copyString(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
  key: string,
): void {
  const value = source[key];
  if (typeof value === 'string' && value.trim()) target[key] = value.trim();
}

export function sanitizeDmLeadInput(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};

  const source = input as Record<string, unknown>;
  const lead: Record<string, unknown> = {};

  for (const key of ['name', 'sector', 'source', 'stage', 'currency', 'chat_room_id']) {
    copyString(lead, source, key);
  }

  if (typeof source.value_cents === 'number' && Number.isFinite(source.value_cents)) {
    lead.value_cents = source.value_cents;
  }

  if (typeof source.content_id === 'string' && isUuidLike(source.content_id)) {
    lead.content_id = source.content_id.trim();
  }

  if (source.metadata && typeof source.metadata === 'object' && !Array.isArray(source.metadata)) {
    const rawMetadata = source.metadata as Record<string, unknown>;
    const metadata: Record<string, string> = {};
    for (const key of PUBLIC_METADATA_KEYS) {
      const value = rawMetadata[key];
      if (typeof value === 'string' && value.trim()) metadata[key] = value.trim();
    }
    if (Object.keys(metadata).length > 0) lead.metadata = metadata;
  }

  return lead;
}
