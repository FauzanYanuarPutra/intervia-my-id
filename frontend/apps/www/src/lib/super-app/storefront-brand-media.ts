export type StorefrontBrandMedia = {
  logoUrl: string | null;
  coverUrl: string | null;
  galleryUrls: string[];
  seoImageUrl: string | null;
};

const LOGO_KEYS = ['logo_url', 'avatar_url', 'profile_image_url'] as const;
const COVER_KEYS = [
  'banner_url',
  'cover_image_url',
  'cover_url',
  'store_photo_url',
] as const;
const LEGACY_IMAGE_KEYS = [
  'image_url',
  'imageUrl',
  'image',
  'menu_photo_url',
] as const;
const GALLERY_KEYS = ['gallery_images', 'gallery', 'images', 'photos'] as const;

function publicMetadata(
  metadata: Record<string, unknown>,
): Record<string, unknown> {
  const nested =
    metadata.public &&
    typeof metadata.public === 'object' &&
    !Array.isArray(metadata.public)
      ? (metadata.public as Record<string, unknown>)
      : {};
  return { ...metadata, ...nested };
}

function readText(
  metadata: Record<string, unknown>,
  keys: readonly string[],
): string {
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function readTextArrays(
  metadata: Record<string, unknown>,
  keys: readonly string[],
): string[] {
  return keys.flatMap(key => {
    const value = metadata[key];
    if (Array.isArray(value)) {
      return value
        .map(item => (typeof item === 'string' ? item.trim() : ''))
        .filter(Boolean);
    }
    if (typeof value === 'string') {
      return value
        .split(/[,\n]/)
        .map(item => item.trim())
        .filter(Boolean);
    }
    return [];
  });
}

function usableImage(value: string): boolean {
  return Boolean(value) && !value.includes('/images/placeholders/');
}

function unique(values: string[]): string[] {
  return Array.from(
    new Set(values.map(value => value.trim()).filter(usableImage)),
  );
}

export function resolveStorefrontBrandMedia(
  metadata: Record<string, unknown>,
): StorefrontBrandMedia {
  const publicMeta = publicMetadata(metadata);
  const explicitLogo = readText(publicMeta, LOGO_KEYS);
  const explicitCover = readText(publicMeta, COVER_KEYS);
  const legacyGeneralImage = readText(publicMeta, LEGACY_IMAGE_KEYS);
  const rawGallery = unique(readTextArrays(publicMeta, GALLERY_KEYS));
  const logoUrl = usableImage(explicitLogo) ? explicitLogo : null;
  const coverUrl =
    [explicitCover, rawGallery[0], legacyGeneralImage].find(usableImage) ?? null;
  const galleryUrls = rawGallery
    .filter(image => image !== logoUrl && image !== coverUrl)
    .slice(0, 6);

  return {
    logoUrl,
    coverUrl,
    galleryUrls,
    seoImageUrl: coverUrl || logoUrl || galleryUrls[0] || null,
  };
}
