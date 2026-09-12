import type { BusinessRecord, BusinessRelationship, PortalRole } from './portal-types';

export type CollaborationInvitationStatus = 'pending' | 'accepted' | 'rejected' | 'expired' | string;

export type OrganizationMember = {
  userId: string;
  email: string;
  username: string;
  fullName: string;
  role: string;
  status: string;
  joinedAt: string;
};

export type OrganizationInvitation = {
  id: string;
  organizationId: string;
  organizationName: string;
  inviteeUserId: string;
  inviteeUsername: string;
  role: string;
  status: CollaborationInvitationStatus;
  expiresAt: string;
  createdAt: string;
  respondedAt: string;
};

export function deriveBusinessRelationship(input: {
  actorId: string;
  organizationOwnerUserId?: string | null;
  storeOwnerUserId?: string | null;
  currentRole?: PortalRole;
}): BusinessRelationship {
  const actorId = input.actorId.trim();
  if (
    actorId &&
    (input.organizationOwnerUserId?.trim() === actorId || input.storeOwnerUserId?.trim() === actorId)
  ) {
    return 'owned';
  }
  return input.currentRole === 'owner' ? 'owned' : 'joined';
}

export function relationshipOfBusiness(business: BusinessRecord): BusinessRelationship {
  return business.relationship ?? (business.currentRole === 'owner' ? 'owned' : 'joined');
}

export function groupBusinessesByRelationship(businesses: BusinessRecord[]) {
  return businesses.reduce<{ owned: BusinessRecord[]; joined: BusinessRecord[] }>(
    (groups, business) => {
      groups[relationshipOfBusiness(business)].push(business);
      return groups;
    },
    { owned: [], joined: [] },
  );
}

export function organizationRoleLabel(role: string): string {
  switch (role.trim().toLowerCase()) {
    case 'owner':
    case 'org_owner':
      return 'Pemilik';
    case 'admin':
    case 'org_admin':
      return 'Admin usaha';
    case 'manager':
    case 'org_manager':
      return 'Manager';
    case 'cashier':
    case 'org_cashier':
      return 'Kasir';
    case 'org_inventory':
      return 'Stok & pembelian';
    case 'org_accounting':
      return 'Keuangan';
    case 'viewer':
    case 'org_viewer':
      return 'Pantau';
    default:
      return role.trim() || 'Anggota';
  }
}

export function portalRoleRelationshipLabel(role: PortalRole): string {
  if (role === 'owner') return 'Pemilik';
  if (role === 'manager') return 'Manager';
  if (role === 'cashier') return 'Kasir';
  return 'Pantau';
}

export function invitationStatusLabel(status: CollaborationInvitationStatus): string {
  switch (status.trim().toLowerCase()) {
    case 'pending':
      return 'Menunggu';
    case 'accepted':
      return 'Diterima';
    case 'rejected':
    case 'declined':
      return 'Ditolak';
    case 'expired':
      return 'Kedaluwarsa';
    default:
      return status.trim() || 'Tidak diketahui';
  }
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function extractItems(payload: unknown): Record<string, unknown>[] {
  const root = objectValue(payload) ?? {};
  const data = objectValue(root.data);
  const candidates = [data?.items, root.items, root.data].find(Array.isArray);
  return Array.isArray(candidates)
    ? candidates.filter((item): item is Record<string, unknown> => Boolean(objectValue(item)))
    : [];
}

export function parseOrganizationMembers(payload: unknown): OrganizationMember[] {
  return extractItems(payload)
    .map(item => ({
      userId: stringValue(item.user_id ?? item.userId),
      email: stringValue(item.email),
      username: stringValue(item.username),
      fullName: stringValue(item.full_name ?? item.fullName),
      role: stringValue(item.role),
      status: stringValue(item.status) || 'active',
      joinedAt: stringValue(item.joined_at ?? item.joinedAt),
    }))
    .filter(item => Boolean(item.userId));
}

export function parseOrganizationInvitations(payload: unknown): OrganizationInvitation[] {
  return extractItems(payload)
    .map(item => ({
      id: stringValue(item.id),
      organizationId: stringValue(item.org_id ?? item.organization_id ?? item.organizationId),
      organizationName: stringValue(item.organization_name ?? item.organizationName),
      inviteeUserId: stringValue(item.invitee_user_id ?? item.inviteeUserId),
      inviteeUsername: stringValue(item.invitee_username ?? item.inviteeUsername),
      role: stringValue(item.role),
      status: stringValue(item.status) || 'pending',
      expiresAt: stringValue(item.expires_at ?? item.expiresAt),
      createdAt: stringValue(item.created_at ?? item.createdAt),
      respondedAt: stringValue(item.responded_at ?? item.respondedAt),
    }))
    .filter(item => Boolean(item.id));
}
