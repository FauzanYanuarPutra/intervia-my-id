export type ExploreHubIntent = 'supply' | 'demand';
export type ExploreHubLocale = 'id' | 'en';

function normalizeQuery(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function buildExploreHubSearchHref(
  locale: ExploreHubLocale,
  intent: ExploreHubIntent,
  query: string,
): string {
  const clean = normalizeQuery(query);
  const params = new URLSearchParams();

  if (clean) params.set('q', clean);
  params.set('side', intent);

  if (intent === 'demand') {
    params.set('tab', 'needs');
  }

  const search = params.toString();
  return `/${locale}/explore${search ? `?${search}` : ''}`;
}

/**
 * The business map is still a dedicated public discovery surface. Keep this
 * explicit until its map/deep-link behavior has full parity inside Explore.
 */
export function buildNearbyBusinessesHref(): string {
  return '/umkm?view=map';
}
