export const INVITATIONS_CHANGED_EVENT = 'lajukan:invitations-changed';

export type PendingOrganizationInvitation = {
  id: string;
  organizationId: string;
  organizationName: string;
  role: string;
  status: string;
  expiresAt: string;
};

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function parsePendingInvitations(payload: unknown): PendingOrganizationInvitation[] {
  const root = objectValue(payload) ?? {};
  const data = objectValue(root.data);
  const candidates = [data?.items, root.items, root.data].find(Array.isArray);
  if (!Array.isArray(candidates)) return [];

  return candidates
    .map(value => {
      const item = objectValue(value);
      if (!item) return null;
      const id = stringValue(item.id);
      const organizationName = stringValue(item.organization_name ?? item.organizationName);
      if (!id || !organizationName) return null;
      return {
        id,
        organizationId: stringValue(item.org_id ?? item.organization_id ?? item.organizationId),
        organizationName,
        role: stringValue(item.role),
        status: stringValue(item.status) || 'pending',
        expiresAt: stringValue(item.expires_at ?? item.expiresAt),
      };
    })
    .filter((item): item is PendingOrganizationInvitation => Boolean(item));
}

export function activeInvitationCount(invitations: PendingOrganizationInvitation[]): number {
  return invitations.filter(invitation => invitation.status === 'pending').length;
}

export function invitationExpiryLabel(expiresAt: string, locale = 'id-ID'): string {
  if (!expiresAt) return 'Masa berlaku tidak tersedia';
  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) return 'Masa berlaku tidak tersedia';
  return `Berlaku sampai ${new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date)}`;
}
