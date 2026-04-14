import type {
  ContentItem,
  ContentMetadata,
  ContentOwnerProfile,
} from '@/lib/content/catalog';

type PublicProfileIdentity = {
  id?: unknown;
  username?: unknown;
  full_name?: unknown;
  title?: unknown;
};

type ProfileRouteContentItem = Pick<
  ContentItem,
  'owner_id' | 'title' | 'content_type' | 'owner_profile' | 'metadata'
>;

type ProfileRecord = Record<string, unknown>;

function asRecord(value: unknown): ProfileRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as ProfileRecord;
}

function readString(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

function slugifySegment(value: unknown): string {
  return readString(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

export function normalizePublicProfileHandleInput(value: unknown): string {
  return slugifySegment(value);
}

function normalizeSlug(value: string): string {
  return decodePublicProfileSlug(value).trim().toLowerCase();
}

export function decodePublicProfileSlug(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function extractPublicProfileIdFromSlug(
  slug: string,
): string | undefined {
  const decoded = decodePublicProfileSlug(slug);
  const separatorIndex = decoded.lastIndexOf('--');
  if (separatorIndex < 0) return undefined;
  const id = decoded.slice(separatorIndex + 2).trim();
  return id || undefined;
}

export function buildPublicProfileSlug(identity: PublicProfileIdentity): string {
  const id = readString(identity.id);
  const usernameSlug = slugifySegment(identity.username);
  if (usernameSlug) return usernameSlug;

  const base =
    slugifySegment(identity.full_name) ||
    slugifySegment(identity.title) ||
    'member';
  return id ? `${base}--${encodeURIComponent(id)}` : base;
}

export function buildPublicProfileHref(
  identity: PublicProfileIdentity,
  basePath = '/profile',
): string {
  const base = basePath.replace(/\/$/, '') || '/profile';
  return `${base}/${buildPublicProfileSlug(identity)}`;
}

export function candidatePublicProfileSlugs(
  identity: PublicProfileIdentity,
): string[] {
  const slugs = new Set<string>();
  const usernameSlug = slugifySegment(identity.username);
  const fullNameSlug = slugifySegment(identity.full_name);
  const titleSlug = slugifySegment(identity.title);
  const id = readString(identity.id);
  const canonicalSlug = buildPublicProfileSlug(identity);
  const legacyUsernameSlug =
    usernameSlug && id ? `${usernameSlug}--${encodeURIComponent(id)}` : '';

  if (canonicalSlug) slugs.add(canonicalSlug);
  if (legacyUsernameSlug) slugs.add(legacyUsernameSlug);
  if (usernameSlug) slugs.add(usernameSlug);
  if (fullNameSlug) slugs.add(fullNameSlug);
  if (titleSlug) slugs.add(titleSlug);

  return Array.from(slugs);
}

export function matchesPublicProfileSlug(
  slug: string,
  identity: PublicProfileIdentity,
): boolean {
  const normalizedSlug = normalizeSlug(slug);
  if (!normalizedSlug) return false;
  return candidatePublicProfileSlugs(identity).some(
    candidate => normalizeSlug(candidate) === normalizedSlug,
  );
}

function readMetadataProfile(
  metadata: ContentMetadata | null | undefined,
): ContentOwnerProfile | ProfileRecord | null {
  const record = asRecord(metadata);
  return (
    asRecord(record?.owner_profile) ||
    asRecord(record?.seller_profile) ||
    null
  );
}

function readMetadataPublicPath(
  metadata: ContentMetadata | null | undefined,
): string {
  const record = asRecord(metadata);
  const raw = readString(record?.public_path);
  return raw.startsWith('/profile/') ? raw : '';
}

export function resolveOwnerUserIdFromContent(
  item: ProfileRouteContentItem,
): string | null {
  const metadata = asRecord(item.metadata);
  const ownerProfile =
    asRecord(item.owner_profile) || readMetadataProfile(metadata);
  const id =
    readString(ownerProfile?.id) ||
    readString(item.owner_id) ||
    readString(metadata?.owner_id) ||
    readString(metadata?.user_id) ||
    readString(metadata?.seller_id) ||
    '';

  return id || null;
}

export function buildPublicProfileHrefFromContent(
  item: ProfileRouteContentItem,
): string | null {
  const metadata = asRecord(item.metadata);
  const embeddedPath = readMetadataPublicPath(metadata);
  if (embeddedPath) return embeddedPath;

  const ownerProfile =
    asRecord(item.owner_profile) || readMetadataProfile(metadata);
  const id = resolveOwnerUserIdFromContent(item) || '';

  if (!id) return null;

  return buildPublicProfileHref({
    id,
    username:
      ownerProfile?.username || metadata?.username || metadata?.owner_username,
    full_name:
      ownerProfile?.full_name ||
      metadata?.full_name ||
      metadata?.display_name ||
      item.title,
    title: item.title,
  });
}
