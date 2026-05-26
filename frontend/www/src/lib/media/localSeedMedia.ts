export type LocalSeedContentTopic =
  | 'listing'
  | 'property'
  | 'job'
  | 'talent'
  | 'service'
  | 'product';

const HOME_VISUALS = {
  hero: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=80',
  supplier:
    'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1200&q=80',
  location:
    'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80',
  support:
    'https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=1200&q=80',
} as const;

function normalizeSeed(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-') || 'lajukan'
  );
}

function seedIndex(seed: string, length: number): number {
  const normalized = normalizeSeed(seed);
  let hash = 0;

  for (let index = 0; index < normalized.length; index += 1) {
    hash = (hash * 31 + normalized.charCodeAt(index)) >>> 0;
  }

  return hash % length;
}

function seededLocalImage(seed: string, candidates: readonly string[]): string {
  return candidates[seedIndex(seed, candidates.length)] || candidates[0];
}

export function localAvatarForSeed(seed?: string): string {
  return seededLocalImage(`avatar-${seed || 'default'}`, [
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&q=80',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=300&q=80',
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80',
    'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=300&q=80',
  ]);
}

export function localContentImageForTopic(
  topic: LocalSeedContentTopic,
  seed?: string,
): string {
  const topicImages: Record<LocalSeedContentTopic, readonly string[]> = {
    listing: [
      'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=900&q=80',
    ],
    property: [
      'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&w=900&q=80',
    ],
    job: [
      'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1573497019418-b400bb3ab074?auto=format&fit=crop&w=900&q=80',
    ],
    talent: [
      'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?auto=format&fit=crop&w=900&q=80',
    ],
    service: [
      'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&w=900&q=80',
    ],
    product: [
      'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=900&q=80',
    ],
  };

  return seededLocalImage(
    `content-${topic}-${seed || '0'}`,
    topicImages[topic],
  );
}

export function localProductImageForCategory(
  category?: string | null,
  seed?: string,
): string {
  const normalized = String(category || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-');

  if (/(fresh|buah|sayur|juice|jus|sehat|hydro)/.test(normalized)) {
    return 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=900&q=80';
  }
  if (/(bakery|roti|pastry|coffee|kopi|cafe|minuman)/.test(normalized)) {
    return 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=900&q=80';
  }
  if (
    /(retail|souvenir|fashion|gift|oleh|craft|marketplace)/.test(normalized)
  ) {
    return 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=900&q=80';
  }
  if (
    /(food|frozen|ayam|daging|telur|seafood|main|course|makanan)/.test(
      normalized,
    )
  ) {
    return 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=900&q=80';
  }

  return seededLocalImage(`product-${normalized || 'general'}-${seed || '0'}`, [
    'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=900&q=80',
  ]);
}

export function localUmkmStoreVisual(seed?: string, hint?: string): string {
  const text = `${hint || ''} ${seed || ''}`.toLowerCase();

  if (
    /(jasa|service|salon|barber|desain|design|printing|laundry|studio|foto|fotografi|admin|konsultan)/.test(
      text,
    )
  ) {
    return localContentImageForTopic('service', seed);
  }
  if (
    /(bengkel|workshop|machining|bubut|las|konveksi|furniture|produksi|manufaktur|craft|kriya)/.test(
      text,
    )
  ) {
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
  if (
    /(souvenir|retail|pasar|craft|fashion|boutique|tas|gift|oleh-oleh)/.test(
      text,
    )
  ) {
    return localProductImageForCategory('retail', seed);
  }

  return localProductImageForCategory('main_course', seed);
}

export function localHomeVisual(
  key: keyof typeof HOME_VISUALS,
): (typeof HOME_VISUALS)[keyof typeof HOME_VISUALS] {
  return HOME_VISUALS[key];
}
