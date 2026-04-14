import { findStoreMemberRecordByActor } from './umkm-commerce.repository';
import type {
  UmkmStoreMemberRole,
  UmkmStorePermission,
} from './umkm-commerce.types';

type BaseAccessInput = {
  storeId: string;
  ownerUserId: string;
  actorUserId: string;
  actorEmail?: string | null;
  roles?: string[];
};

type PermissionAccessInput = BaseAccessInput & {
  permission: UmkmStorePermission;
};

type ManageAccessInput = {
  ownerUserId: string;
  actorUserId: string;
  actorEmail?: string | null;
  roles?: string[];
  storeId?: string;
};

const ADMIN_ROLE_SET = new Set(['admin', 'super_admin']);

const ALL_UMKM_PERMISSIONS: UmkmStorePermission[] = [
  'store:view',
  'store:update',
  'store:publish',
  'team:manage',
  'product:manage',
  'table:manage',
  'qr:manage',
  'order:manage',
  'reservation:manage',
  'payment:manage',
];

const ROLE_PERMISSION_MAP: Record<UmkmStoreMemberRole, UmkmStorePermission[]> = {
  owner: ALL_UMKM_PERMISSIONS,
  manager: [
    'store:view',
    'store:update',
    'store:publish',
    'product:manage',
    'table:manage',
    'qr:manage',
    'order:manage',
    'reservation:manage',
    'payment:manage',
  ],
  cashier: ['store:view', 'order:manage', 'payment:manage'],
  stock: ['store:view', 'product:manage'],
  ops: ['store:view', 'table:manage', 'qr:manage', 'order:manage', 'reservation:manage'],
  finance: ['store:view', 'payment:manage'],
};

function normalizeRoles(roles?: string[]): Set<string> {
  return new Set((roles || []).map((role) => String(role).toLowerCase()));
}

function isAdminLike(roles?: string[]): boolean {
  const normalized = normalizeRoles(roles);
  return Array.from(ADMIN_ROLE_SET).some((role) => normalized.has(role));
}

export function getPermissionsForUmkmRole(role: UmkmStoreMemberRole): UmkmStorePermission[] {
  return [...(ROLE_PERMISSION_MAP[role] || [])];
}

export function getUmkmStoreAccess(input: BaseAccessInput): {
  allowed: boolean;
  role: UmkmStoreMemberRole | 'admin' | null;
  via: 'owner' | 'member' | 'admin' | null;
  permissions: UmkmStorePermission[];
} {
  if (input.ownerUserId === input.actorUserId) {
    return {
      allowed: true,
      role: 'owner',
      via: 'owner',
      permissions: getPermissionsForUmkmRole('owner'),
    };
  }

  if (isAdminLike(input.roles)) {
    return {
      allowed: true,
      role: 'admin',
      via: 'admin',
      permissions: [...ALL_UMKM_PERMISSIONS],
    };
  }

  const member = findStoreMemberRecordByActor({
    storeId: input.storeId,
    userId: input.actorUserId,
    email: input.actorEmail,
  });

  if (!member) {
    return {
      allowed: false,
      role: null,
      via: null,
      permissions: [],
    };
  }

  return {
    allowed: true,
    role: member.role,
    via: 'member',
    permissions: Array.isArray(member.permissions)
      ? [...member.permissions]
      : getPermissionsForUmkmRole(member.role),
  };
}

export function hasUmkmStorePermission(input: PermissionAccessInput): boolean {
  const access = getUmkmStoreAccess(input);
  if (!access.allowed) return false;
  return access.permissions.includes(input.permission);
}

export function canManageUmkmStore(input: ManageAccessInput): boolean {
  if (input.ownerUserId === input.actorUserId) return true;
  if (isAdminLike(input.roles)) return true;
  if (!input.storeId) return false;

  return hasUmkmStorePermission({
    storeId: input.storeId,
    ownerUserId: input.ownerUserId,
    actorUserId: input.actorUserId,
    actorEmail: input.actorEmail,
    roles: input.roles,
    permission: 'store:update',
  });
}
