type ContentRecord = Record<string, unknown>;

function asString(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

function asObject(value: unknown): ContentRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as ContentRecord)
    : null;
}

export function isEditorialContentRecord(item: ContentRecord): boolean {
  const metadata = asObject(item.metadata);
  const news = asObject(metadata?.news);
  if (news && Object.keys(news).length > 0) return true;

  const rawType = [item.content_type, item.type]
    .map(asString)
    .join(' ')
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

  return /(?:^|_)(news|article|guide)(?:_|$)/.test(rawType);
}
