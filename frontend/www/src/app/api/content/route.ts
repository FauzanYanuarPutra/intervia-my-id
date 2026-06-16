import { NextRequest, NextResponse } from 'next/server';
import {
  attachOwnerProfilesToContent,
  fetchOwnerPublicProfiles,
  shouldIncludeOwnerProfiles,
} from '@/lib/content/ownerProfiles';
import { buildPublicProfileHref } from '@/lib/profile/publicProfileLink';
import {
  DEFAULT_PROFILE_AVATAR,
  readProfileAvatarStyle,
} from '@/lib/profile/avatar';

const marketplaceBase =
  process.env.INTERNAL_MARKETPLACE_URL ||
  process.env.NEXT_PUBLIC_MARKETPLACE_URL ||
  'http://localhost:8081';
const identityBase =
  process.env.INTERNAL_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:8080';

type ContentRecord = Record<string, unknown>;
type SearchIntent = 'all' | 'provider' | 'seeker';
type SearchType =
  | 'all'
  | 'job'
  | 'freelancer'
  | 'product'
  | 'property'
  | 'service'
  | 'tool_rental'
  | 'business_transfer'
  | 'umkm';
type SearchContentType = Exclude<SearchType, 'all' | 'umkm'>;

function defaultPriceUnitForContentType(type: SearchContentType): string {
  if (type === 'property') return 'month';
  if (type === 'tool_rental') return 'day';
  if (type === 'job') return 'month';
  if (type === 'freelancer') return 'hour';
  if (type === 'service') return 'project';
  if (type === 'business_transfer') return 'deal';
  return 'pcs';
}

type DiscoverUser = {
  id: string;
  email?: string | null;
  phone?: string | null;
  username?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
  avatar_style?: unknown;
  avatarStyle?: unknown;
  metadata?: ContentRecord | null;
  location?: string | null;
  bio?: string | null;
  headline?: string | null;
  roles?: string[] | null;
  metadata_roles?: unknown;
  level?: string | null;
  rating?: number | string | null;
  completed_jobs?: number | string | null;
  hourly_rate?: number | string | null;
  freelancer_profile?: ContentRecord | null;
  provider_profile?: ContentRecord | null;
  buyer_profile?: ContentRecord | null;
  created_at?: string | null;
};

type ContentListPayload = {
  items?: ContentRecord[];
  limit?: number;
  offset?: number;
  has_more?: boolean;
};

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 70);
}

function asString(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

function isEnabledFlag(value: string | null): boolean {
  const normalized = (value || '').trim().toLowerCase();
  return (
    normalized === '1' ||
    normalized === 'true' ||
    normalized === 'yes' ||
    normalized === 'database' ||
    normalized === 'content_items'
  );
}

function asObject(value: unknown): ContentRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as ContentRecord)
    : null;
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(entry => asString(entry))
    .filter((entry): entry is string => Boolean(entry));
}

function hasValue(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number') return Number.isFinite(value) && value > 0;
  if (typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object')
    return Object.keys(value as ContentRecord).length > 0;
  return false;
}

function normalizeSearchType(value: string | null): SearchType {
  if (value === 'job') return 'job';
  if (
    value === 'freelancer' ||
    value === 'talent' ||
    value === 'user' ||
    value === 'users' ||
    value === 'profile'
  ) {
    return 'freelancer';
  }
  if (value === 'product') return 'product';
  if (value === 'property') return 'property';
  if (value === 'service') return 'service';
  if (value === 'tool_rental') return 'tool_rental';
  if (
    value === 'business_transfer' ||
    value === 'business-transfer' ||
    value === 'oper-usaha' ||
    value === 'oper_usaha' ||
    value === 'jual-usaha' ||
    value === 'usaha-berjalan' ||
    value === 'handover' ||
    value === 'takeover'
  ) {
    return 'business_transfer';
  }
  if (value === 'umkm') return 'umkm';
  return 'all';
}

function isDiscoverableTalentUser(user: DiscoverUser): boolean {
  const displayName =
    asString(user.full_name) || asString(user.username) || asString(user.email);
  const roles = collectUserRoles(user);
  const hasTalentRole = roles.some(role =>
    /freelancer|talent|creator|admin|sales|marketing|designer|developer|operator|driver|host|cs|support|consultant/.test(
      role,
    ),
  );
  const hasTalentProfile = hasValue(user.freelancer_profile);
  const hasWorkSignal =
    hasTalentProfile ||
    hasTalentRole ||
    hasValue(user.hourly_rate) ||
    hasValue(user.level);
  const hasProfileBasics = Boolean(
    displayName && asString(user.headline) && asString(user.location),
  );

  return Boolean(
    displayName &&
    hasWorkSignal &&
    (hasTalentProfile || hasProfileBasics || hasValue(user.hourly_rate)),
  );
}

function normalizeLocationMatch(
  value: string,
  locationFilter: string,
): boolean {
  if (!locationFilter.trim()) return true;
  const source = normalizeSearchText(value);
  const target = normalizeSearchText(locationFilter);
  if (!target) return true;
  return source.includes(target);
}

function compactIdr(value: number | null): string {
  if (value == null || !Number.isFinite(value) || value <= 0) return 'IDR';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Math.round(value / 100));
}

function toCentsFromMajor(value: unknown): number | null {
  const amount = toNumber(value);
  if (amount == null || amount <= 0) return null;
  return Math.round(amount * 100);
}

function pickFirstNonEmpty(...values: unknown[]): string {
  for (const value of values) {
    const normalized = asString(value);
    if (normalized) return normalized;
  }
  return '';
}

function listPreview(value: unknown, limit = 3): string {
  return asStringList(value).slice(0, limit).join(', ');
}

function joinPreviewParts(parts: Array<unknown>, limit = 4): string {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const part of parts) {
    const normalized = asString(part);
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
    if (result.length >= limit) break;
  }

  return result.join(' - ');
}

function collectUserRoles(user: DiscoverUser): string[] {
  const roleSet = new Set<string>();
  for (const role of asStringList(user.roles)) {
    roleSet.add(role.toLowerCase());
  }
  for (const role of asStringList(user.metadata_roles)) {
    roleSet.add(role.toLowerCase());
  }
  return Array.from(roleSet);
}

function inferBuyerDomain(
  buyerProfile: ContentRecord | null,
  requestedType: SearchType,
  query: string,
): SearchContentType {
  if (requestedType !== 'all') {
    if (requestedType === 'freelancer') return 'service';
    if (requestedType === 'umkm') return 'product';
    return requestedType;
  }

  const signal = normalizeSearchText(
    [
      asString(buyerProfile?.intent),
      asString(buyerProfile?.preferred_sector),
      asString(buyerProfile?.preferred_sub_sector),
      asString(buyerProfile?.preferred_location),
      query,
    ]
      .filter(Boolean)
      .join(' '),
  );

  if (
    signal.includes('oper usaha') ||
    signal.includes('jual usaha') ||
    signal.includes('usaha berjalan') ||
    signal.includes('business transfer') ||
    signal.includes('handover') ||
    signal.includes('takeover')
  ) {
    return 'business_transfer';
  }
  if (
    signal.includes('property') ||
    signal.includes('properti') ||
    signal.includes('rumah') ||
    signal.includes('apartment') ||
    signal.includes('apartemen')
  ) {
    return 'property';
  }
  if (
    signal.includes('rental') ||
    signal.includes('rent') ||
    signal.includes('sewa') ||
    signal.includes('kamera') ||
    signal.includes('alat')
  ) {
    return 'tool_rental';
  }
  if (
    signal.includes('service') ||
    signal.includes('jasa') ||
    signal.includes('vendor') ||
    signal.includes('agency') ||
    signal.includes('talent')
  ) {
    return 'service';
  }
  if (
    signal.includes('job') ||
    signal.includes('kerja') ||
    signal.includes('kandidat') ||
    signal.includes('candidate') ||
    signal.includes('hire')
  ) {
    return 'job';
  }
  return 'product';
}

function buildPersonSearchRecord({
  user,
  side,
  contentType,
  title,
  summary,
  priceCents,
  priceLabel,
  priceUnit,
  searchKind,
  profile,
}: {
  user: DiscoverUser;
  side: Exclude<SearchIntent, 'all'>;
  contentType: SearchContentType;
  title: string;
  summary: string;
  priceCents: number | null;
  priceLabel?: string;
  priceUnit?: string;
  searchKind: string;
  profile?: ContentRecord | null;
}): ContentRecord {
  const displayName =
    asString(user.full_name) ||
    asString(user.username) ||
    asString(user.email) ||
    'Lajukan member';
  const userLocation =
    asString(user.location) ||
    asString(profile?.preferred_location) ||
    'Indonesia';
  const publicPath = buildPublicProfileHref({
    id: user.id,
    username: user.username,
    full_name: user.full_name || displayName,
    title: displayName,
  });
  const createdAt = asString(user.created_at) || null;
  const avatarStyle = readProfileAvatarStyle(user);
  return {
    id: `${user.id}:${side}:${searchKind}`,
    owner_id: user.id,
    slug: `${slugify(displayName)}-${user.id}`,
    title,
    summary,
    body: summary,
    content_type: contentType,
    category: contentType,
    content_status: 'active',
    status: 'active',
    cover_image: DEFAULT_PROFILE_AVATAR,
    price_cents: priceCents,
    price_unit: priceUnit || defaultPriceUnitForContentType(contentType),
    currency: 'IDR',
    created_at: createdAt,
    updated_at: createdAt,
    owner_profile: {
      id: user.id,
      username: user.username || null,
      full_name: user.full_name || displayName,
      avatar_url: user.avatar_url || DEFAULT_PROFILE_AVATAR,
      avatar_style: avatarStyle,
      avatarStyle: avatarStyle,
      metadata: user.metadata || null,
      location: user.location || userLocation,
      headline: asString(user.headline) || asString(profile?.headline) || null,
      roles: collectUserRoles(user),
      level: user.level || null,
      rating: toNumber(user.rating),
      completed_jobs: toNumber(user.completed_jobs),
    },
    metadata: {
      source: 'users_discover',
      entity_kind: 'person',
      market_side: side,
      search_kind: searchKind,
      search_domain: contentType,
      search_price_label: priceLabel || undefined,
      price_unit: priceUnit || defaultPriceUnitForContentType(contentType),
      public_path: publicPath,
      display_name: displayName,
      avatar_style: avatarStyle,
      location: userLocation,
      headline:
        pickFirstNonEmpty(profile?.headline, user.headline, user.bio) ||
        undefined,
      skills: asStringList(profile?.skills),
      service_coverage: asStringList(profile?.service_coverage),
      intent: asString(profile?.intent) || undefined,
      preferred_sector: asString(profile?.preferred_sector) || undefined,
      preferred_sub_sector:
        asString(profile?.preferred_sub_sector) || undefined,
      preferred_location: asString(profile?.preferred_location) || undefined,
      work_mode: asString(profile?.work_mode) || undefined,
      full_name: user.full_name || null,
      username: user.username || null,
      email: user.email || null,
      roles: collectUserRoles(user),
      bio: user.bio || null,
      freelancer_profile: user.freelancer_profile || null,
      provider_profile: user.provider_profile || null,
      buyer_profile: user.buyer_profile || null,
      search_text: [
        displayName,
        title,
        summary,
        asString(user.headline),
        asString(user.bio),
        userLocation,
        collectUserRoles(user).join(' '),
      ]
        .filter(Boolean)
        .join(' '),
    },
  };
}

function buildProviderSearchRecord(user: DiscoverUser): ContentRecord | null {
  const profile = asObject(user.provider_profile);
  if (!profile || !hasValue(profile)) return null;

  const displayName =
    asString(user.full_name) ||
    asString(user.username) ||
    asString(user.email) ||
    'Lajukan provider';
  const priceCents =
    toCentsFromMajor(profile.price_min) ??
    toCentsFromMajor(user.hourly_rate) ??
    toCentsFromMajor(profile.price_max);
  const summary =
    joinPreviewParts([
      pickFirstNonEmpty(profile.headline, user.headline, user.bio),
      listPreview(profile.skills),
      listPreview(profile.service_coverage),
      asString(profile.work_mode),
      asString(profile.response_time),
    ]) || 'Service provider on Lajukan';

  return buildPersonSearchRecord({
    user,
    side: 'provider',
    contentType: 'service',
    title: displayName,
    summary,
    priceCents,
    priceLabel: priceCents ? compactIdr(priceCents) : undefined,
    priceUnit:
      asString(profile.price_unit) ||
      asString(profile.rate_period) ||
      (priceCents && toCentsFromMajor(user.hourly_rate) === priceCents
        ? 'hour'
        : 'project'),
    searchKind: 'provider_profile',
    profile,
  });
}

function buildBuyerSearchRecord(
  user: DiscoverUser,
  requestedType: SearchType,
  query: string,
): ContentRecord | null {
  const profile = asObject(user.buyer_profile);
  if (!profile || !hasValue(profile)) return null;

  const inferredType = inferBuyerDomain(profile, requestedType, query);
  if (requestedType !== 'all' && requestedType !== inferredType) return null;

  const displayName =
    asString(user.full_name) ||
    asString(user.username) ||
    asString(user.email) ||
    'Lajukan member';
  const budgetMin = toCentsFromMajor(profile.budget_min);
  const budgetMax = toCentsFromMajor(profile.budget_max);
  const priceCents = budgetMin ?? budgetMax;
  const budgetLabel =
    budgetMin && budgetMax
      ? `${compactIdr(budgetMin)} - ${compactIdr(budgetMax)}`
      : compactIdr(priceCents);
  const intent = pickFirstNonEmpty(profile.intent, user.headline);
  const title = intent || displayName;
  const summary =
    joinPreviewParts([
      title === displayName ? '' : displayName,
      asString(profile.preferred_sector),
      asString(profile.preferred_sub_sector),
      pickFirstNonEmpty(profile.preferred_location, user.location),
      priceCents ? `Budget ${budgetLabel}` : '',
    ]) || `${displayName} is looking for ${inferredType.replace(/_/g, ' ')}`;

  return buildPersonSearchRecord({
    user,
    side: 'seeker',
    contentType: inferredType,
    title,
    summary,
    priceCents,
    priceLabel: priceCents ? budgetLabel : undefined,
    searchKind: 'buyer_profile',
    profile,
  });
}

function normalizeSearchText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenizeSearch(value: string): string[] {
  return normalizeSearchText(value)
    .split(' ')
    .map(token => token.trim())
    .filter(token => token.length >= 2)
    .slice(0, 12);
}

function uniqueTokens(tokens: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const token of tokens) {
    if (!seen.has(token)) {
      seen.add(token);
      result.push(token);
    }
  }
  return result;
}

function toIsoTimestamp(value: unknown): number {
  if (typeof value !== 'string' || !value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function levenshteinDistance(a: string, b: string, maxDistance = 6): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  if (Math.abs(a.length - b.length) > maxDistance) return maxDistance + 1;

  let previous = new Array<number>(b.length + 1);
  let current = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j += 1) previous[j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    let rowMin = current[0];
    const leftCode = a.charCodeAt(i - 1);

    for (let j = 1; j <= b.length; j += 1) {
      const cost = leftCode === b.charCodeAt(j - 1) ? 0 : 1;
      const insertion = current[j - 1] + 1;
      const deletion = previous[j] + 1;
      const replacement = previous[j - 1] + cost;
      const next = Math.min(insertion, deletion, replacement);
      current[j] = next;
      if (next < rowMin) rowMin = next;
    }

    if (rowMin > maxDistance) return maxDistance + 1;
    [previous, current] = [current, previous];
  }

  return previous[b.length];
}

function diceCoefficient(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;

  const pairs = new Map<string, number>();
  for (let i = 0; i < a.length - 1; i += 1) {
    const pair = a.slice(i, i + 2);
    pairs.set(pair, (pairs.get(pair) || 0) + 1);
  }

  let overlap = 0;
  for (let i = 0; i < b.length - 1; i += 1) {
    const pair = b.slice(i, i + 2);
    const count = pairs.get(pair) || 0;
    if (count > 0) {
      overlap += 1;
      pairs.set(pair, count - 1);
    }
  }

  return (2 * overlap) / (a.length + b.length - 2);
}

function tokenSimilarity(queryToken: string, candidateToken: string): number {
  if (!queryToken || !candidateToken) return 0;
  if (queryToken === candidateToken) return 1;
  if (
    candidateToken.includes(queryToken) ||
    queryToken.includes(candidateToken)
  ) {
    const lengthDelta = Math.abs(queryToken.length - candidateToken.length);
    return Math.max(0.76, 0.95 - lengthDelta * 0.03);
  }

  const dice = diceCoefficient(queryToken, candidateToken);
  const maxLen = Math.max(queryToken.length, candidateToken.length);
  const maxDistance = Math.max(2, Math.floor(maxLen * 0.45));
  const distance = levenshteinDistance(queryToken, candidateToken, maxDistance);
  const editSimilarity = Math.max(0, 1 - distance / maxLen);

  return Math.max(dice * 0.82, editSimilarity * 0.9);
}

function scoreField(
  queryNormalized: string,
  queryTokens: string[],
  field: string,
): number {
  if (!queryNormalized || !field) return 0;
  if (field.includes(queryNormalized)) return 1;

  const fieldTokens = uniqueTokens(
    field.split(' ').filter(token => token.length >= 2),
  );
  if (fieldTokens.length === 0 || queryTokens.length === 0) return 0;

  let total = 0;
  let matched = 0;
  for (const queryToken of queryTokens) {
    let best = 0;
    for (const candidateToken of fieldTokens) {
      const similarity = tokenSimilarity(queryToken, candidateToken);
      if (similarity > best) best = similarity;
      if (best >= 0.995) break;
    }
    total += best;
    if (best >= 0.68) matched += 1;
  }

  const coverage = matched / queryTokens.length;
  const tokenAverage = total / queryTokens.length;
  const phraseSimilarity = diceCoefficient(
    queryNormalized,
    field.slice(0, 220),
  );

  return Math.min(
    1,
    Math.max(tokenAverage * 0.78 + coverage * 0.22, phraseSimilarity * 0.75),
  );
}

function collectMetadataText(metadata: unknown): string {
  const obj = asObject(metadata);
  if (!obj) return '';

  const preferredKeys = [
    'type',
    'category',
    'location',
    'city',
    'country',
    'sector',
    'sub_sector',
    'profession',
    'headline',
    'company',
    'skills',
    'specialization',
    'job_type',
    'employment_type',
    'work_mode',
    'role',
    'level',
    'seniority',
    'education',
    'certificate',
    'certification',
  ];

  const parts: string[] = [];
  for (const key of preferredKeys) {
    const value = obj[key];
    if (typeof value === 'string' && value.trim()) {
      parts.push(value.trim());
      continue;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      parts.push(String(value));
      continue;
    }
    if (Array.isArray(value)) {
      for (const entry of value.slice(0, 12)) {
        if (typeof entry === 'string' && entry.trim()) parts.push(entry.trim());
      }
    }
  }

  if (parts.length < 12) {
    for (const [key, value] of Object.entries(obj).slice(0, 20)) {
      if (preferredKeys.includes(key)) continue;
      if (typeof value === 'string' && value.trim()) {
        parts.push(value.trim());
      } else if (typeof value === 'number' && Number.isFinite(value)) {
        parts.push(String(value));
      } else if (Array.isArray(value)) {
        for (const entry of value.slice(0, 8)) {
          if (typeof entry === 'string' && entry.trim())
            parts.push(entry.trim());
        }
      }
      if (parts.length >= 20) break;
    }
  }

  return normalizeSearchText(parts.join(' ').slice(0, 700));
}

function scoreContentItem(
  item: ContentRecord,
  query: string,
): {
  score: number;
  textSignal: number;
  exact: boolean;
  createdAt: number;
} {
  const queryNormalized = normalizeSearchText(query);
  const queryTokens = uniqueTokens(tokenizeSearch(queryNormalized));
  if (!queryNormalized || queryTokens.length === 0) {
    return { score: 0, textSignal: 0, exact: false, createdAt: 0 };
  }

  const title = normalizeSearchText(asString(item.title));
  const summary = normalizeSearchText(asString(item.summary));
  const body = normalizeSearchText(asString(item.body).slice(0, 900));
  const slug = normalizeSearchText(asString(item.slug));
  const tags = normalizeSearchText(
    Array.isArray(item.tags)
      ? item.tags
          .map(value => asString(value))
          .filter(Boolean)
          .join(' ')
      : asString(item.tags),
  );
  const metadata = collectMetadataText(item.metadata);

  const titleScore = scoreField(queryNormalized, queryTokens, title);
  const summaryScore = scoreField(queryNormalized, queryTokens, summary);
  const bodyScore = scoreField(queryNormalized, queryTokens, body);
  const slugScore = scoreField(queryNormalized, queryTokens, slug);
  const tagsScore = scoreField(queryNormalized, queryTokens, tags);
  const metadataScore = scoreField(queryNormalized, queryTokens, metadata);

  const combinedText = [title, summary, slug, tags, metadata]
    .filter(Boolean)
    .join(' ');
  const exact = combinedText.includes(queryNormalized);
  const tokenCoverage =
    queryTokens.filter(token => combinedText.includes(token)).length /
    queryTokens.length;

  let score =
    titleScore * 0.44 +
    summaryScore * 0.19 +
    tagsScore * 0.14 +
    metadataScore * 0.12 +
    bodyScore * 0.08 +
    slugScore * 0.03;

  if (exact) score += 0.18;
  if (tokenCoverage >= 0.8) score += 0.06;
  else if (tokenCoverage >= 0.55) score += 0.03;

  const createdAt = Math.max(
    toIsoTimestamp(item.created_at),
    toIsoTimestamp(item.updated_at),
  );
  if (createdAt > 0) {
    const ageDays = (Date.now() - createdAt) / 86_400_000;
    if (ageDays <= 7) score += 0.04;
    else if (ageDays <= 30) score += 0.02;
    else if (ageDays <= 90) score += 0.01;
  }

  const textSignal = Math.max(
    titleScore,
    summaryScore,
    tagsScore,
    metadataScore,
    slugScore,
  );
  return {
    score: Math.min(score, 1.35),
    textSignal,
    exact,
    createdAt,
  };
}

function isLikelyRelevant(
  score: number,
  signal: number,
  tokenCount: number,
  exact: boolean,
): boolean {
  if (exact) return true;
  const scoreThreshold =
    tokenCount <= 1 ? 0.22 : tokenCount === 2 ? 0.18 : 0.15;
  const signalThreshold = tokenCount <= 1 ? 0.2 : 0.14;
  return score >= scoreThreshold && signal >= signalThreshold;
}

function normalizePayload(
  payload: ContentListPayload | null,
  fallbackLimit: number,
  fallbackOffset: number,
): ContentListPayload {
  if (!payload || typeof payload !== 'object') {
    return {
      items: [],
      limit: fallbackLimit,
      offset: fallbackOffset,
      has_more: false,
    };
  }
  return {
    items: Array.isArray(payload.items)
      ? payload.items.filter((item): item is ContentRecord =>
          Boolean(asObject(item)),
        )
      : [],
    limit: toNumber(payload.limit) ?? fallbackLimit,
    offset: toNumber(payload.offset) ?? fallbackOffset,
    has_more: Boolean(payload.has_more),
  };
}

function mergeUniqueContent(items: ContentRecord[]): ContentRecord[] {
  const seen = new Set<string>();
  const result: ContentRecord[] = [];
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const id = asString(item.id) || asString(item.slug) || `row-${index}`;
    if (seen.has(id)) continue;
    seen.add(id);
    result.push(item);
  }
  return result;
}

function rerankByQuery(items: ContentRecord[], query: string): ContentRecord[] {
  const queryTokens = uniqueTokens(tokenizeSearch(query));
  if (!query || queryTokens.length === 0 || items.length === 0) return items;

  const ranked = items
    .map(item => {
      const scored = scoreContentItem(item, query);
      return { item, ...scored };
    })
    .filter(entry =>
      isLikelyRelevant(
        entry.score,
        entry.textSignal,
        queryTokens.length,
        entry.exact,
      ),
    )
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      if (left.exact !== right.exact)
        return Number(right.exact) - Number(left.exact);
      return right.createdAt - left.createdAt;
    });

  return ranked.map(entry => entry.item);
}

function parseSafeInt(
  value: string | null,
  fallback: number,
  min: number,
  max: number,
): number {
  const parsed = Number.parseInt(value || '', 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

function mapUserToFreelancerContent(
  user: DiscoverUser,
): Record<string, unknown> {
  const displayName = user.full_name || user.username || user.email || 'Talent';
  const primaryRole =
    user.level ||
    (Array.isArray(user.roles) && user.roles.length > 0
      ? user.roles[0]
      : null) ||
    'member';
  const roleLabel = String(primaryRole).replace(/_/g, ' ');
  const rating = toNumber(user.rating);
  const completedJobs = toNumber(user.completed_jobs);
  const hourlyRate = toNumber(user.hourly_rate);
  const avatarStyle = readProfileAvatarStyle(user);

  return {
    id: user.id,
    slug: `${slugify(displayName)}-${user.id}`,
    title: displayName,
    summary:
      user.headline ||
      (roleLabel === 'member'
        ? 'Registered talent profile on Lajukan'
        : `${roleLabel} profile on Lajukan`),
    body: user.headline || '',
    content_type: 'freelancer',
    category: 'freelancer',
    content_status: 'active',
    status: 'active',
    cover_image: DEFAULT_PROFILE_AVATAR,
    owner_id: user.id,
    price_cents:
      hourlyRate != null ? Math.max(0, Math.round(hourlyRate * 100)) : 0,
    price_unit: 'hour',
    currency: 'IDR',
    rating: rating ?? undefined,
    seller_stats: {
      rating: rating ?? undefined,
      completed_transactions: completedJobs ?? undefined,
    },
    owner_profile: {
      id: user.id,
      username: user.username || null,
      full_name: user.full_name || displayName,
      avatar_url: user.avatar_url || DEFAULT_PROFILE_AVATAR,
      avatar_style: avatarStyle,
      avatarStyle: avatarStyle,
      metadata: user.metadata || null,
      location: user.location || null,
      headline: user.headline || null,
      roles: Array.isArray(user.roles) ? user.roles : [],
      level: user.level || null,
      rating: rating ?? null,
      completed_jobs: completedJobs ?? null,
    },
    metadata: {
      source: 'users_discover',
      entity_kind: 'person',
      public_path: buildPublicProfileHref({
        id: user.id,
        username: user.username || null,
        full_name: user.full_name || displayName,
        title: displayName,
      }),
      full_name: user.full_name || null,
      username: user.username || null,
      email: user.email || null,
      phone: user.phone || null,
      avatar_url: user.avatar_url || DEFAULT_PROFILE_AVATAR,
      avatar_style: avatarStyle,
      location: user.location || null,
      headline: user.headline || null,
      roles: Array.isArray(user.roles) ? user.roles : [],
      level: user.level || null,
      rating: rating ?? null,
      completed_jobs: completedJobs ?? null,
      hourly_rate: hourlyRate ?? null,
      price_unit: 'hour',
    },
  };
}

function getAuthToken(req: NextRequest): string | null {
  return (
    req.headers.get('authorization')?.replace('Bearer ', '') ||
    req.cookies.get('access_token')?.value ||
    null
  );
}

async function fetchMarketplaceContent(
  params: URLSearchParams,
): Promise<{ response: Response; payload: ContentListPayload | null }> {
  const query = params.toString();
  const response = await fetch(
    `${marketplaceBase}/v1/content${query ? `?${query}` : ''}`,
    {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(15000),
    },
  );
  const payload = (await response
    .json()
    .catch(() => null)) as ContentListPayload | null;
  return { response, payload };
}

async function fetchDiscoverUsers(
  req: NextRequest,
  options: {
    query?: string;
    limit: number;
  },
): Promise<DiscoverUser[]> {
  try {
    const userLookup = new URL('/users/discover', identityBase);
    userLookup.searchParams.set(
      'limit',
      String(Math.min(Math.max(options.limit, 1), 25)),
    );
    const query = (options.query || '').trim();
    if (query) userLookup.searchParams.set('q', query);

    const token = getAuthToken(req);
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetch(userLookup.toString(), {
      method: 'GET',
      headers,
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return [];

    const payload = (await response.json().catch(() => ({}))) as {
      data?: DiscoverUser[];
    };
    return Array.isArray(payload.data) ? payload.data : [];
  } catch (error) {
    console.error('[api/content] discover users fetch failed:', error);
    return [];
  }
}

function filterDiscoverCandidatesByLocation(
  items: ContentRecord[],
  locationFilter: string,
): ContentRecord[] {
  if (!locationFilter.trim()) return items;

  return items.filter(item => {
    const metadata = asObject(item.metadata);
    const source = [
      asString(metadata?.location),
      asString(metadata?.preferred_location),
      asString(item.title),
      asString(item.summary),
    ]
      .filter(Boolean)
      .join(' ');

    return normalizeLocationMatch(source, locationFilter);
  });
}

function buildDiscoverContentCandidates(
  users: DiscoverUser[],
  input: {
    requestedType: SearchType;
    query: string;
    locationFilter: string;
  },
): ContentRecord[] {
  const items: ContentRecord[] = [];

  for (const user of users) {
    if (
      (input.requestedType === 'all' || input.requestedType === 'service') &&
      hasValue(user.provider_profile)
    ) {
      const providerRecord = buildProviderSearchRecord(user);
      if (providerRecord) items.push(providerRecord);
    }

    if (
      input.requestedType !== 'freelancer' &&
      input.requestedType !== 'umkm' &&
      hasValue(user.buyer_profile)
    ) {
      const buyerRecord = buildBuyerSearchRecord(
        user,
        input.requestedType,
        input.query,
      );
      if (buyerRecord) items.push(buyerRecord);
    }

    const shouldIncludeTalentCandidate =
      input.requestedType === 'freelancer'
        ? isDiscoverableTalentUser(user)
        : hasValue(user.freelancer_profile);

    if (
      (input.requestedType === 'all' || input.requestedType === 'freelancer') &&
      shouldIncludeTalentCandidate
    ) {
      items.push(mapUserToFreelancerContent(user));
    }
  }

  return filterDiscoverCandidatesByLocation(items, input.locationFilter);
}

async function fetchDiscoverContentCandidates(
  req: NextRequest,
  input: {
    requestedType: SearchType;
    query: string;
    locationFilter: string;
    limit: number;
  },
): Promise<ContentRecord[]> {
  const users = await fetchDiscoverUsers(req, {
    query: input.query,
    limit: Math.min(Math.max(input.limit * 2, 12), 25),
  });

  return buildDiscoverContentCandidates(users, input);
}

async function fetchExpandedCandidates(
  searchParams: URLSearchParams,
  limit: number,
): Promise<ContentRecord[]> {
  try {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('q');
    params.set('offset', '0');
    params.set('limit', String(Math.min(Math.max(limit * 4, 40), 100)));

    const { response, payload } = await fetchMarketplaceContent(params);
    if (!response.ok) return [];
    return normalizePayload(payload, limit, 0).items || [];
  } catch (error) {
    console.error('[api/content] expanded candidate fetch failed:', error);
    return [];
  }
}

async function getTalentFallback(
  req: NextRequest,
  searchParams: URLSearchParams,
): Promise<ContentListPayload | null> {
  try {
    const limit = Math.min(
      Math.max(Number.parseInt(searchParams.get('limit') || '12', 10) || 12, 1),
      60,
    );
    const offset = Math.max(
      Number.parseInt(searchParams.get('offset') || '0', 10) || 0,
      0,
    );
    const q = (searchParams.get('q') || '').trim();
    const users = (
      await fetchDiscoverUsers(req, {
        query: q,
        limit: Math.min(limit, 25),
      })
    ).filter(isDiscoverableTalentUser);

    return {
      items: users.map(mapUserToFreelancerContent),
      limit,
      offset,
      has_more: false,
    };
  } catch (error) {
    console.error('[api/content] freelancer fallback failed:', error);
    return null;
  }
}

export async function GET(req: NextRequest) {
  if (!marketplaceBase) {
    return NextResponse.json(
      { error: 'Marketplace service URL not configured' },
      { status: 500 },
    );
  }

  const url = new URL(req.url);
  const searchParams = url.searchParams;
  const queryText = (searchParams.get('q') || '').trim();
  const requestedLimit = parseSafeInt(searchParams.get('limit'), 20, 1, 100);
  const requestedOffset = parseSafeInt(
    searchParams.get('offset'),
    0,
    0,
    Number.MAX_SAFE_INTEGER,
  );
  const requestedTypeRaw = (searchParams.get('type') || '')
    .trim()
    .toLowerCase();
  const requestedType =
    requestedTypeRaw === 'talent' ||
    requestedTypeRaw === 'user' ||
    requestedTypeRaw === 'users' ||
    requestedTypeRaw === 'profile'
      ? 'freelancer'
      : normalizeSearchType(searchParams.get('type'));
  const includeOwnerProfiles = shouldIncludeOwnerProfiles(searchParams);
  const databaseOnly =
    isEnabledFlag(searchParams.get('database_only')) ||
    isEnabledFlag(searchParams.get('backend_only')) ||
    isEnabledFlag(searchParams.get('content_items_only')) ||
    isEnabledFlag(searchParams.get('source'));
  const shouldFallbackTalent =
    !databaseOnly &&
    (requestedType === 'freelancer' ||
      requestedTypeRaw === 'talent' ||
      requestedTypeRaw === 'user' ||
      requestedTypeRaw === 'users' ||
      requestedTypeRaw === 'profile');

  try {
    const { response: backendRes, payload: data } =
      await fetchMarketplaceContent(searchParams);
    if (!backendRes.ok) {
      console.error('[api/content] backend error:', backendRes.status, data);
      return NextResponse.json(
        {
          error: 'Marketplace service returned an error',
          status: backendRes.status,
          data: Array.isArray(data) ? data : (data ?? null),
        },
        { status: backendRes.status },
      );
    }

    let resolvedPayload = normalizePayload(
      data,
      requestedLimit,
      requestedOffset,
    );
    let resolvedItems = resolvedPayload.items || [];

    const shouldIncludeDiscoverCandidates =
      !databaseOnly &&
      (requestedType === 'all' ||
        requestedType === 'service' ||
        requestedType === 'freelancer' ||
        queryText.length >= 2);
    const discoverCandidates = shouldIncludeDiscoverCandidates
      ? await fetchDiscoverContentCandidates(req, {
          requestedType,
          query: queryText,
          locationFilter: searchParams.get('location') || '',
          limit: requestedLimit,
        })
      : [];

    if (shouldFallbackTalent && resolvedItems.length === 0) {
      const fallback = await getTalentFallback(req, searchParams);
      if (
        fallback &&
        Array.isArray(fallback.items) &&
        fallback.items.length > 0
      ) {
        resolvedPayload = normalizePayload(
          fallback,
          requestedLimit,
          requestedOffset,
        );
        resolvedItems = resolvedPayload.items || [];
      }
    }

    const shouldRunFuzzyRerank = queryText.length >= 2;
    if (shouldRunFuzzyRerank) {
      let candidates = resolvedItems;
      const shouldExpandCandidates =
        candidates.length < Math.min(Math.max(requestedLimit * 2, 14), 40);
      if (shouldExpandCandidates) {
        const expanded = await fetchExpandedCandidates(
          searchParams,
          requestedLimit,
        );
        if (expanded.length > 0) {
          candidates = mergeUniqueContent([...candidates, ...expanded]);
        }
      } else {
        candidates = mergeUniqueContent(candidates);
      }

      if (discoverCandidates.length > 0) {
        candidates = mergeUniqueContent([...discoverCandidates, ...candidates]);
      }

      const reranked = rerankByQuery(candidates, queryText);
      if (reranked.length > 0) {
        const start = Math.min(requestedOffset, reranked.length);
        const paged = reranked.slice(start, start + requestedLimit);
        resolvedPayload = {
          items: paged,
          limit: requestedLimit,
          offset: requestedOffset,
          has_more: start + requestedLimit < reranked.length,
        };
      }
    } else if (requestedOffset === 0 && discoverCandidates.length > 0) {
      const mergedItems = mergeUniqueContent([
        ...resolvedItems,
        ...discoverCandidates,
      ]);
      resolvedPayload = {
        ...resolvedPayload,
        items: mergedItems.slice(0, requestedLimit),
        limit: requestedLimit,
        offset: 0,
        has_more:
          mergedItems.length > requestedLimit || resolvedPayload.has_more,
      };
    }

    if (
      includeOwnerProfiles &&
      Array.isArray(resolvedPayload.items) &&
      resolvedPayload.items.length > 0
    ) {
      const ownerProfiles = await fetchOwnerPublicProfiles({
        req,
        identityBase,
        items: resolvedPayload.items,
      });
      if (ownerProfiles.size > 0) {
        resolvedPayload = {
          ...resolvedPayload,
          items: attachOwnerProfilesToContent(
            resolvedPayload.items,
            ownerProfiles,
          ),
        };
      }
    }

    return NextResponse.json(resolvedPayload, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    console.error('[api/content] marketplace unreachable:', message);
    return NextResponse.json(
      { error: 'Marketplace service unavailable' },
      { status: 503 },
    );
  }
}
