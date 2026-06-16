import { normalizeContentMediaUrl } from '@/lib/content/catalog';

export type UploadedProfileDocument = {
  name?: string;
  url: string;
  size?: number;
  mime?: string;
};

type ProfileMediaRecord = Record<string, unknown>;

function asObject(value: unknown): ProfileMediaRecord | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return undefined;
  return value as ProfileMediaRecord;
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
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  return result;
}

function isInlineSvgDataUrl(value: string): boolean {
  return /^data:image\/svg\+xml/i.test(value.trim());
}

export function normalizeProfileMediaUrl(value: unknown): string | undefined {
  const raw = readNonEmptyString(value);
  if (!raw) return undefined;
  return normalizeContentMediaUrl(raw);
}

export function normalizeProfileMediaList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return uniqueStrings(
      value.map(entry => {
        if (typeof entry === 'string') return normalizeProfileMediaUrl(entry);
        if (entry && typeof entry === 'object') {
          return normalizeProfileMediaUrl((entry as ProfileMediaRecord).url);
        }
        return undefined;
      }),
    );
  }

  return uniqueStrings([normalizeProfileMediaUrl(value)]);
}

export function extractUploadedImageUrls(payload: unknown): string[] {
  if (!payload || typeof payload !== 'object') return [];
  const body = payload as ProfileMediaRecord;
  return normalizeProfileMediaList(body.urls);
}

export function extractFirstUploadedImageUrl(
  payload: unknown,
): string | undefined {
  return extractUploadedImageUrls(payload)[0];
}

export function extractUploadedDocumentFiles(
  payload: unknown,
): UploadedProfileDocument[] {
  if (!payload || typeof payload !== 'object') return [];
  const body = payload as ProfileMediaRecord;
  const files = Array.isArray(body.files) ? body.files : [];
  const docs: UploadedProfileDocument[] = [];
  const seen = new Set<string>();

  for (const entry of files) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const record = entry as ProfileMediaRecord;
    const url = normalizeProfileMediaUrl(record.url);
    if (!url) continue;
    const dedupKey = url.toLowerCase();
    if (seen.has(dedupKey)) continue;
    seen.add(dedupKey);
    docs.push({
      name: readNonEmptyString(record.name),
      url,
      size: typeof record.size === 'number' ? record.size : undefined,
      mime: readNonEmptyString(record.mime),
    });
  }

  if (docs.length > 0) return docs;

  return extractUploadedDocumentUrls(payload).map(url => ({ url }));
}

export function extractUploadedDocumentUrls(payload: unknown): string[] {
  if (!payload || typeof payload !== 'object') return [];
  const body = payload as ProfileMediaRecord;
  return uniqueStrings([
    ...normalizeProfileMediaList(body.files),
    ...normalizeProfileMediaList(body.urls),
  ]);
}

export function normalizeProfilePayloadMedia(payload: unknown): unknown {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload))
    return payload;

  const body = { ...(payload as ProfileMediaRecord) };
  const metadata = asObject(body.metadata)
    ? { ...(body.metadata as ProfileMediaRecord) }
    : undefined;
  const bodyMedia = asObject(body.media)
    ? { ...(body.media as ProfileMediaRecord) }
    : undefined;
  const metadataMedia =
    metadata && asObject(metadata.media)
      ? { ...(metadata.media as ProfileMediaRecord) }
      : undefined;
  const media = {
    ...(metadataMedia || {}),
    ...(bodyMedia || {}),
  };

  const avatar =
    normalizeProfileMediaUrl(body.avatarUrl) ||
    normalizeProfileMediaUrl(body.avatar_url) ||
    normalizeProfileMediaUrl(metadata?.avatar_url) ||
    normalizeProfileMediaUrl(media.avatar_url);
  if (avatar) {
    body.avatarUrl = avatar;
    body.avatar_url = avatar;
    if (!isInlineSvgDataUrl(avatar)) {
      if (metadata) metadata.avatar_url = avatar;
      media.avatar_url = avatar;
    }
  }

  const cover =
    normalizeProfileMediaUrl(body.cover_image) ||
    normalizeProfileMediaUrl(metadata?.cover_image) ||
    normalizeProfileMediaUrl(media.cover_image);
  if (cover) {
    body.cover_image = cover;
    if (metadata) metadata.cover_image = cover;
    media.cover_image = cover;
  }

  const galleryImages = uniqueStrings([
    ...normalizeProfileMediaList(body.image_urls),
    ...normalizeProfileMediaList(body.gallery_images),
    ...normalizeProfileMediaList(metadata?.gallery_images),
    ...normalizeProfileMediaList(media.gallery_images),
    ...normalizeProfileMediaList(media.image_urls),
  ]);
  if (galleryImages.length > 0) {
    body.image_urls = galleryImages;
    if (metadata) metadata.gallery_images = galleryImages;
    media.gallery_images = galleryImages;
  }

  const documentUrls = uniqueStrings([
    ...normalizeProfileMediaList(body.document_urls),
    ...normalizeProfileMediaList(metadata?.documents),
    ...normalizeProfileMediaList(media.documents),
  ]);
  if (documentUrls.length > 0) {
    body.document_urls = documentUrls;
    if (metadata) metadata.documents = documentUrls;
    media.documents = documentUrls;
  }

  if (Object.keys(media).length > 0) {
    body.media = media;
    if (metadata) metadata.media = media;
  }

  if (metadata) {
    body.metadata = metadata;
  }

  return body;
}
