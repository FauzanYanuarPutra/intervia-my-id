export type StorefrontBrandMedia = {
  logoUrl: string | null;
  coverUrl: string | null;
  galleryUrls: string[];
  seoImageUrl: string | null;
};

function readText(metadata: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function readTextArrays(metadata: Record<string, unknown>, keys: string[]): string[] {
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
  return Array.from(new Set(values.map(value => value.trim()).filter(usableImage)));
}

export function resolveStorefrontBrandMedia(
  metadata: Record<string, unknown>,
): StorefrontBrandMedia {
  const explicitLogo = readText(metadata, ['logo_url', 'store_photo_url']);
  const explicitCover = readText(metadata, ['banner_url', 'cover_image_url', 'cover_url']);
  const legacyGeneralImage = readText(metadata, [
    'image_url',
    'imageUrl',
    'image',
    'menu_photo_url',
  ]);
  const rawGallery = unique(
    readTextArrays(metadata, ['gallery_images', 'gallery', 'images', 'photos']),
  );
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
