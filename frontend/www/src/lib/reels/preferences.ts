export type ReelPreferenceProfile = {
  terms: Record<string, number>;
  searches: string[];
  signals: number;
  updatedAt: number;
};

type ReelPreferenceItem = {
  title: string;
  creator: string;
  caption: string;
  tag: string;
  productName?: string | null;
  productPrice?: string | null;
  likes: string;
  comments: string;
  shares: string;
  likesCount?: number | null;
  commentsCount?: number | null;
  sharesCount?: number | null;
};

const PROFILE_STORAGE_KEY = 'lajukan.reels.preference.v1';
const SOUND_STORAGE_KEY = 'lajukan.reels.sound.v1';
const MAX_SEARCHES = 12;
const MAX_TERM_WEIGHT = 999;

const STOP_WORDS = new Set([
  'dan',
  'atau',
  'yang',
  'untuk',
  'dengan',
  'the',
  'and',
  'for',
  'a',
  'an',
  'to',
  'of',
  'di',
  'ke',
  'ini',
  'itu',
  'buat',
  'cara',
]);

const COMPACT_MULTIPLIERS: Record<string, number> = {
  K: 1_000,
  M: 1_000_000,
  B: 1_000_000_000,
  T: 1_000_000_000_000,
};

export function createEmptyReelPreferenceProfile(): ReelPreferenceProfile {
  return { terms: {}, searches: [], signals: 0, updatedAt: Date.now() };
}

export function readReelPreferenceProfile(): ReelPreferenceProfile {
  if (typeof window === 'undefined') return createEmptyReelPreferenceProfile();

  try {
    const raw = window.localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) return createEmptyReelPreferenceProfile();
    const parsed = JSON.parse(raw) as Partial<ReelPreferenceProfile>;

    return {
      terms:
        parsed.terms && typeof parsed.terms === 'object' ? parsed.terms : {},
      searches: Array.isArray(parsed.searches)
        ? parsed.searches.filter(value => typeof value === 'string').slice(0, MAX_SEARCHES)
        : [],
      signals: Number.isFinite(parsed.signals) ? Number(parsed.signals) : 0,
      updatedAt: Number.isFinite(parsed.updatedAt)
        ? Number(parsed.updatedAt)
        : Date.now(),
    };
  } catch {
    return createEmptyReelPreferenceProfile();
  }
}

export function writeReelPreferenceProfile(profile: ReelPreferenceProfile) {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // A blocked or full localStorage should never break video playback.
  }
}

export function readReelsMutedPreference() {
  if (typeof window === 'undefined') return true;

  try {
    return window.localStorage.getItem(SOUND_STORAGE_KEY) !== 'on';
  } catch {
    return true;
  }
}

export function writeReelsMutedPreference(muted: boolean) {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(SOUND_STORAGE_KEY, muted ? 'off' : 'on');
  } catch {
    // Playback remains usable when preferences cannot be persisted.
  }
}

export function normalizeReelToken(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .trim();
}

export function tokenizeReelText(value: string) {
  return normalizeReelToken(value)
    .split(/\s+/)
    .map(token => token.replace(/^-+|-+$/g, ''))
    .filter(token => token.length > 2 && !STOP_WORDS.has(token));
}

export function getReelPreferenceTokens(reel: ReelPreferenceItem) {
  return [
    ...tokenizeReelText(reel.title),
    ...tokenizeReelText(reel.creator),
    ...tokenizeReelText(reel.caption),
    ...tokenizeReelText(reel.tag),
    ...tokenizeReelText(reel.productName || ''),
    ...tokenizeReelText(reel.productPrice || ''),
  ];
}

export function boostReelPreferenceProfile(
  profile: ReelPreferenceProfile,
  tokens: string[],
  weight: number,
  search?: string,
) {
  const next: ReelPreferenceProfile = {
    terms: { ...profile.terms },
    searches: [...profile.searches],
    signals: profile.signals + 1,
    updatedAt: Date.now(),
  };

  tokens.forEach(token => {
    next.terms[token] = Math.min(
      (next.terms[token] || 0) + weight,
      MAX_TERM_WEIGHT,
    );
  });

  const normalizedSearch = normalizeReelToken(search || '');
  if (normalizedSearch) {
    next.searches = [
      normalizedSearch,
      ...next.searches.filter(item => item !== normalizedSearch),
    ].slice(0, MAX_SEARCHES);
    tokenizeReelText(normalizedSearch).forEach(token => {
      next.terms[token] = Math.min(
        (next.terms[token] || 0) + weight * 1.4,
        MAX_TERM_WEIGHT,
      );
    });
  }

  return next;
}

export function scoreReelPreference(
  reel: ReelPreferenceItem,
  profile: ReelPreferenceProfile,
  query = '',
) {
  const tokens = getReelPreferenceTokens(reel);
  const queryTokens = tokenizeReelText(query);
  const preferenceScore = tokens.reduce(
    (total, token) => total + (profile.terms[token] || 0),
    0,
  );
  const queryScore = queryTokens.reduce(
    (total, token) => total + (tokens.includes(token) ? 80 : 0),
    0,
  );

  return preferenceScore + queryScore;
}

export function getTopReelPreferenceTerms(profile: ReelPreferenceProfile) {
  return Object.entries(profile.terms)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([term]) => term);
}

export function rankReelsByPreference<T extends ReelPreferenceItem>(
  items: T[],
  profile: ReelPreferenceProfile,
) {
  return [...items].sort(
    (a, b) =>
      scoreReelPreference(b, profile) - scoreReelPreference(a, profile),
  );
}

export function parseCompactReelMetric(value: string) {
  const match = value.trim().match(/^([\d.,]+)\s*([KMBT])?/i);
  if (!match) return 0;
  const amount = Number.parseFloat(match[1].replace(',', '.'));
  const suffix = (match[2] || '').toUpperCase();
  return Number.isFinite(amount)
    ? Math.round(amount * (COMPACT_MULTIPLIERS[suffix] || 1))
    : 0;
}

export function formatCompactReelMetric(value: number) {
  const suffixes = ['', 'K', 'M', 'B', 'T'];
  let scaled = Number.isFinite(value) ? Math.max(value, 0) : 0;
  let suffixIndex = 0;

  while (scaled >= 1000 && suffixIndex < suffixes.length - 1) {
    scaled /= 1000;
    suffixIndex += 1;
  }

  const formatted =
    scaled >= 100 || suffixIndex === 0
      ? Math.round(scaled).toString()
      : scaled >= 10
        ? scaled.toFixed(1)
        : scaled.toFixed(2);

  return `${formatted.replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1')}${suffixes[suffixIndex]}`;
}

export function getReelMetricCount(
  reel: ReelPreferenceItem,
  field: 'likes' | 'comments' | 'shares',
) {
  const numericKey = `${field}Count` as
    | 'likesCount'
    | 'commentsCount'
    | 'sharesCount';
  const numeric = reel[numericKey];
  return typeof numeric === 'number' && Number.isFinite(numeric)
    ? numeric
    : parseCompactReelMetric(reel[field]);
}
