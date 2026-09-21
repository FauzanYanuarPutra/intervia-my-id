import { normalizeContentMediaUrl } from '@/lib/content/catalog';

type ContentMediaRecord = Record<string, unknown>;

export type UploadedContentImage = {
  url: string;
  name?: string;
};

export type UploadedContentDocument = {
  name?: string;
  url: string;
};

function asObject(value: unknown): ContentMediaRecord | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  return value as ContentMediaRecord;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function normalizeUploadedContentMediaUrl(value: unknown): string {
  const raw = asString(value);
  if (!raw) return '';
  return normalizeContentMediaUrl(raw);
}

function normalizeMediaList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .flatMap(entry => {
        if (typeof entry === 'string') {
          return [normalizeUploadedContentMediaUrl(entry)];
        }
        const record = asObject(entry);
        return [
          normalizeUploadedContentMediaUrl(record?.url),
          normalizeUploadedContentMediaUrl(record?.preview),
        ];
      })
      .filter(Boolean);
  }

  return normalizeUploadedContentMediaUrl(value)
    ? [normalizeUploadedContentMediaUrl(value)]
    : [];
}

export function extractUploadedContentImages(
  payload: unknown,
): UploadedContentImage[] {
  const body = asObject(payload) || {};
  const dataRecord = asObject(body.data);

  const structuredEntries = [
    ...(Array.isArray(body.files) ? body.files : []),
    ...(Array.isArray(body.data) ? body.data : []),
    ...(dataRecord ? [dataRecord] : []),
  ];

  const structured: UploadedContentImage[] = [];
  for (const entry of structuredEntries) {
    if (typeof entry === 'string') {
      const url = normalizeUploadedContentMediaUrl(entry);
      if (url) structured.push({ url });
      continue;
    }

    const record = asObject(entry);
    const url = normalizeUploadedContentMediaUrl(record?.url);
    if (!url) continue;

    structured.push({
      url,
      name: asString(record?.name) || undefined,
    });
  }

  if (structured.length > 0) {
    return structured;
  }

  const fallbackUrls = [
    ...normalizeMediaList(body.urls),
    ...normalizeMediaList(body.image_urls),
  ];

  return fallbackUrls.map(url => ({ url }));
}
export function extractUploadedContentImageUrls(payload: unknown): string[] {
  return extractUploadedContentImages(payload).map(item => item.url);
}

export function extractUploadedContentDocumentFiles(
  payload: unknown,
): UploadedContentDocument[] {
  const body = asObject(payload) || {};
  const entries = Array.isArray(body.files) ? body.files : [];
  const files: UploadedContentDocument[] = [];

  for (const entry of entries) {
    const record = asObject(entry);
    const url = normalizeUploadedContentMediaUrl(record?.url);
    if (!url) continue;
    files.push({
      name: asString(record?.name) || undefined,
      url,
    });
  }

  return files;
}

export function matchUploadedContentImages<
  T extends { id: string; name?: string },
>(
  selected: T[],
  uploaded: UploadedContentImage[],
): Map<string, UploadedContentImage> {
  const remaining = [...uploaded];
  const byName = new Map<string, UploadedContentImage[]>();

  for (const item of remaining) {
    const key = (item.name || '').trim().toLowerCase();
    if (!key) continue;
    const bucket = byName.get(key) || [];
    bucket.push(item);
    byName.set(key, bucket);
  }

  const matched = new Map<string, UploadedContentImage>();

  for (const item of selected) {
    const key = (item.name || '').trim().toLowerCase();
    if (!key) continue;
    const bucket = byName.get(key);
    const next = bucket?.shift();
    if (next) matched.set(item.id, next);
  }

  const hasAnyNamedUpload = remaining.some(
    item => Boolean(item.name?.trim()),
  );

  // Only use positional fallback when the entire response is legacy/unnamed.
  // A mixed response is intentionally left unmatched to avoid assigning a
  // successful URL to the wrong selected file.
  if (!hasAnyNamedUpload) {
    let unnamedIndex = 0;
    for (const item of selected) {
      if (matched.has(item.id)) continue;
      const next = remaining[unnamedIndex];
      if (!next) break;
      unnamedIndex += 1;
      matched.set(item.id, next);
    }
  }

  return matched;
}
