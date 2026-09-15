import type { AuthContext } from '@/lib/serverAuth';
import { listWorkspaceOrganizations } from './business-workspace';
import {
  getPermissionsForUmkmRole,
  hasUmkmStorePermission,
} from './umkm-authorization';
import type {
  UmkmStore,
  UmkmStoreMemberRole,
  UmkmStorePermission,
} from './umkm-commerce.types';

const ORG_ROLE_TO_UMKM_ROLE: Record<string, UmkmStoreMemberRole> = {
  org_admin: 'owner',
  org_manager: 'manager',
  org_cashier: 'cashier',
  org_inventory: 'stock',
  org_accounting: 'finance',
};

export function mapOrganizationRoleToUmkmRole(role: string): UmkmStoreMemberRole | null {
  return ORG_ROLE_TO_UMKM_ROLE[role.trim().toLowerCase()] ?? null;
}

export async function hasUmkmStoreRequestPermission(input: {
  store: Pick<UmkmStore, 'id' | 'owner_user_id' | 'organization_id'>;
  authCtx: AuthContext;
  permission: UmkmStorePermission;
  fetchImpl?: typeof fetch;
}): Promise<boolean> {
  if (
    hasUmkmStorePermission({
      storeId: input.store.id,
      ownerUserId: input.store.owner_user_id,
      actorUserId: input.authCtx.userId,
      actorEmail: input.authCtx.email,
      roles: input.authCtx.roles,
      permission: input.permission,
    })
  ) {
    return true;
  }

  const organizationId = input.store.organization_id?.trim();
  if (!organizationId) return false;

  let organizations;
  try {
    organizations = await listWorkspaceOrganizations({
      token: input.authCtx.token,
      fetchImpl: input.fetchImpl,
    });
  } catch {
    return false;
  }

  const organization = organizations.find(item => item.id === organizationId);
  if (!organization) return false;

  const role = mapOrganizationRoleToUmkmRole(organization.current_user_role);
  if (!role) return false;

  return getPermissionsForUmkmRole(role).includes(input.permission);
}
