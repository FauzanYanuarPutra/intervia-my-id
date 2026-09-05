const SYSTEM_PROFILE_IDS = new Set([
  '00000000-0000-0000-0000-000000000001',
]);

const SYSTEM_PROFILE_HANDLES = new Set([
  'super-admin',
  'super_admin',
  'system',
]);

export function isSystemPublicProfileIdentity(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return false;
  if (SYSTEM_PROFILE_IDS.has(normalized)) return true;

  const handle = normalized.split('--', 1)[0]?.trim() || '';
  return SYSTEM_PROFILE_HANDLES.has(handle);
}

export function isSystemPublicProfileRecord(
  profile: Record<string, unknown> | null | undefined,
): boolean {
  if (!profile) return false;
  return [profile.id, profile.username, profile.slug, profile.handle].some(
    isSystemPublicProfileIdentity,
  );
}
