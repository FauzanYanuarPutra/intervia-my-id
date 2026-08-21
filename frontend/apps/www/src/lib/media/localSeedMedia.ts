export type LocalSeedContentTopic =
  | 'listing'
  | 'property'
  | 'talent'
  | 'job'
  | 'service'
  | 'product';

export function localAvatarForSeed(seed?: string): string {
  void seed;
  return '';
}

export function localContentImageForTopic(
  topic: LocalSeedContentTopic,
  seed?: string,
): string {
  void topic;
  void seed;
  return '';
}

export function localHomeVisual(kind?: string): string {
  void kind;
  return '';
}

export function localProductImageForCategory(
  category?: string,
  seed?: string,
): string {
  void category;
  void seed;
  return '';
}

export function localUmkmStoreVisual(seed?: string, hint?: string): string {
  void seed;
  void hint;
  return '';
}
