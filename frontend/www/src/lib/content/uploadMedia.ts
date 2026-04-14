import { normalizeContentMediaUrl } from '@/lib/content/catalog';

type ContentMediaRecord = Record<string, unknown>;

export type UploadedContentDocument = {
  name?: string;
  url: string;
  size?: number;
  mime?: string;
};

function asObject(value: unknown): ContentMediaRecord | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  return value as ContentMediaRecord;
}

function readNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function uniqueStrings(values: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    if (!value) continue;
    const dedupKey = value.toLowerCase();
    if (seen.has(dedupKey)) continue;
    seen.add(dedupKey);
    result.push(value);
  }

  return result;
}

export function normalizeUploadedContentMediaUrl(
  value: unknown,
): string | undefined {
  const raw = readNonEmptyString(value);
  if (!raw) return undefined;
  const normalized = normalizeContentMediaUrl(raw);
  return normalized || undefined;
}

function normalizeMediaList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return uniqueStrings(
      value.map(entry => {
        if (typeof entry === 'string') {
          return normalizeUploadedContentMediaUrl(entry);
        }
        if (entry && typeof entry === 'object') {
          return normalizeUploadedContentMediaUrl(
            (entry as ContentMediaRecord).url,
          );
        }
        return undefined;
      }),
    );
  }

  return uniqueStrings([normalizeUploadedContentMediaUrl(value)]);
}

export function extractUploadedContentImageUrls(payload: unknown): string[] {
  if (!payload || typeof payload !== 'object') return [];
  const body = payload as ContentMediaRecord;
  const data = asObject(body.data);

  return uniqueStrings([
    ...normalizeMediaList(body.urls),
    ...normalizeMediaList(body.files),
    normalizeUploadedContentMediaUrl(data?.url),
  ]);
}

export function extractUploadedContentDocumentFiles(
  payload: unknown,
): UploadedContentDocument[] {
  if (!payload || typeof payload !== 'object') return [];
  const body = payload as ContentMediaRecord;
  const rawFiles = Array.isArray(body.files) ? body.files : [];
  const files: UploadedContentDocument[] = [];
  const seen = new Set<string>();

  for (const entry of rawFiles) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const record = entry as ContentMediaRecord;
    const url = normalizeUploadedContentMediaUrl(record.url);
    if (!url) continue;
    const dedupKey = url.toLowerCase();
    if (seen.has(dedupKey)) continue;
    seen.add(dedupKey);
    files.push({
      name: readNonEmptyString(record.name),
      url,
      size: typeof record.size === 'number' ? record.size : undefined,
      mime: readNonEmptyString(record.mime),
    });
  }

  if (files.length > 0) return files;

  return extractUploadedContentImageUrls(payload).map(url => ({ url }));
}
