export type LocalSeedContentTopic =
  | 'listing'
  | 'property'
  | 'job'
  | 'talent'
  | 'service'
  | 'product';

const HOME_VISUALS = {
  hero: '/images/umkm/home-hero.png',
  supplier: '/images/umkm/banner-supplier.svg',
  location: '/images/umkm/banner-location.svg',
  support: '/images/umkm/banner-support.svg',
} as const;

function normalizeSeed(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-') || 'lajukan';
}

function picsumSeededImage(seed: string, width: number, height: number): string {
  return `https://picsum.photos/seed/${encodeURIComponent(normalizeSeed(seed))}/${width}/${height}`;
}

export function localAvatarForSeed(seed?: string): string {
  return picsumSeededImage(`avatar-${seed || 'default'}`, 480, 480);
}

export function localContentImageForTopic(
  topic: LocalSeedContentTopic,
  seed?: string,
): string {
  return picsumSeededImage(`content-${topic}-${seed || '0'}`, 1280, 960);
}

export function localProductImageForCategory(
  category?: string | null,
  seed?: string,
): string {
  const normalized = String(category || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-');
  return picsumSeededImage(`product-${normalized || 'general'}-${seed || '0'}`, 1280, 960);
}

export function localUmkmStoreVisual(seed?: string, hint?: string): string {
  const text = `${hint || ''} ${seed || ''}`.toLowerCase();

  if (/(jasa|service|salon|barber|desain|design|printing|laundry|studio|foto|fotografi|admin|konsultan)/.test(text)) {
    return localContentImageForTopic('service', seed);
  }
  if (/(bengkel|workshop|machining|bubut|las|konveksi|furniture|produksi|manufaktur|craft|kriya)/.test(text)) {
    return localContentImageForTopic('listing', seed);
  }
  if (/(lokasi|ruko|kios|booth|lapak|property|space)/.test(text)) {
    return localContentImageForTopic('property', seed);
  }
  if (/(talent|trainer|host|freelance)/.test(text)) {
    return localContentImageForTopic('talent', seed);
  }
  if (/(roti|bakery|pastry|kopi|coffee|cafe)/.test(text)) {
    return localProductImageForCategory('bakery', seed);
  }
  if (/(sehat|fresh|vegan|hydro|buah|sayur|jus|juice)/.test(text)) {
    return localProductImageForCategory('fresh', seed);
  }
  if (/(souvenir|retail|pasar|craft|fashion|boutique|tas|gift|oleh-oleh)/.test(text)) {
    return localProductImageForCategory('retail', seed);
  }

  return localProductImageForCategory('main_course', seed);
}

export function localHomeVisual(
  key: keyof typeof HOME_VISUALS,
): (typeof HOME_VISUALS)[keyof typeof HOME_VISUALS] {
  return HOME_VISUALS[key];
}
