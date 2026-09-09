import type { PortalRole } from '@/lib/portal-types';

const MANAGER_ROLES = new Set(['admin', 'manager', 'org_admin', 'org_manager']);
const CASHIER_ROLES = new Set(['cashier', 'staff', 'operator', 'org_cashier']);

export function normalizeWorkspaceRole(value: string, isOwner: boolean): PortalRole {
  const role = value.trim().toLowerCase();

  if (isOwner || role === 'owner' || role === 'org_owner') return 'owner';
  if (MANAGER_ROLES.has(role)) return 'manager';
  if (CASHIER_ROLES.has(role)) return 'cashier';
  return 'viewer';
}
