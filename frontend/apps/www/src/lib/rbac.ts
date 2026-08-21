/**
 * Role-Based Access Control (RBAC) System
 * Enterprise-grade permission management
 */

// Available roles in the system
export type Role = 
  | 'super_admin'
  | 'admin'
  | 'sales'
  | 'content_admin'
  | 'moderator'
  | 'support'
  | 'business_premium'
  | 'business_basic'
  | 'user'
  | 'guest';

// Available permissions
export type Permission =
  // User management
  | 'manage_users'
  | 'manage_roles'
  | 'view_audit_logs'
  | 'impersonate_user'
  | 'suspend_user'
  // Content
  | 'create_content'
  | 'manage_own_content'
  | 'delete_any_content'
  | 'moderate_content'
  // Features
  | 'access_chat'
  | 'access_marketplace'
  | 'create_transactions'
  | 'access_escrow'
  | 'view_analytics'
  | 'access_api'
  // Admin
  | 'access_admin_panel'
  | 'access_cms'
  | 'access_crm'
  | 'manage_settings';

// Role hierarchy (higher number = more privileged)
export const ROLE_HIERARCHY: Record<Role, number> = {
  super_admin: 100,
  admin: 90,
  sales: 80,
  content_admin: 75,
  moderator: 70,
  support: 60,
  business_premium: 40,
  business_basic: 30,
  user: 20,
  guest: 10,
};

// Permissions assigned to each role
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  super_admin: [
    'manage_users',
    'manage_roles',
    'view_audit_logs',
    'impersonate_user',
    'suspend_user',
    'create_content',
    'manage_own_content',
    'delete_any_content',
    'moderate_content',
    'access_chat',
    'access_marketplace',
    'create_transactions',
    'access_escrow',
    'view_analytics',
    'access_api',
    'access_admin_panel',
    'access_cms',
    'access_crm',
    'manage_settings',
  ],
  admin: [
    'manage_users',
    'view_audit_logs',
    'suspend_user',
    'create_content',
    'manage_own_content',
    'delete_any_content',
    'moderate_content',
    'access_chat',
    'access_marketplace',
    'create_transactions',
    'access_escrow',
    'view_analytics',
    'access_api',
    'access_admin_panel',
    'access_cms',
    'access_crm',
  ],
  sales: [
    'create_content',
    'manage_own_content',
    'access_chat',
    'access_marketplace',
    'view_analytics',
    'access_crm',
  ],
  content_admin: [
    'create_content',
    'manage_own_content',
    'delete_any_content',
    'moderate_content',
    'access_marketplace',
    'access_cms',
  ],
  moderator: [
    'view_audit_logs',
    'create_content',
    'manage_own_content',
    'delete_any_content',
    'moderate_content',
    'access_chat',
    'access_marketplace',
    'create_transactions',
    'view_analytics',
    'access_cms',
  ],
  support: [
    'view_audit_logs',
    'create_content',
    'manage_own_content',
    'access_chat',
    'access_marketplace',
    'access_crm',
  ],
  business_premium: [
    'create_content',
    'manage_own_content',
    'access_chat',
    'access_marketplace',
    'create_transactions',
    'access_escrow',
    'view_analytics',
    'access_api',
  ],
  business_basic: [
    'create_content',
    'manage_own_content',
    'access_chat',
    'access_marketplace',
    'create_transactions',
  ],
  user: [
    'create_content',
    'manage_own_content',
    'access_chat',
    'access_marketplace',
    'create_transactions',
  ],
  guest: [
    'access_marketplace',
  ],
};

/**
 * Check if a role has a specific permission
 */
export function hasPermission(roles: Role[], permission: Permission): boolean {
  for (const role of roles) {
    const permissions = ROLE_PERMISSIONS[role] || [];
    if (permissions.includes(permission)) {
      return true;
    }
  }
  return false;
}

/**
 * Check if user has all required permissions
 */
export function hasAllPermissions(roles: Role[], permissions: Permission[]): boolean {
  return permissions.every(p => hasPermission(roles, p));
}

/**
 * Check if user has any of the required permissions
 */
export function hasAnyPermission(roles: Role[], permissions: Permission[]): boolean {
  return permissions.some(p => hasPermission(roles, p));
}

/**
 * Get all permissions for a set of roles
 */
export function getAllPermissions(roles: Role[]): Permission[] {
  const permissions = new Set<Permission>();
  for (const role of roles) {
    const rolePermissions = ROLE_PERMISSIONS[role] || [];
    rolePermissions.forEach(p => permissions.add(p));
  }
  return Array.from(permissions);
}

/**
 * Get the highest role from a list
 */
export function getHighestRole(roles: Role[]): Role {
  return roles.reduce((highest, role) => {
    return ROLE_HIERARCHY[role] > ROLE_HIERARCHY[highest] ? role : highest;
  }, 'guest' as Role);
}

/**
 * Check if one role can manage another
 */
export function canManageRole(actorRoles: Role[], targetRole: Role): boolean {
  const actorHighest = getHighestRole(actorRoles);
  return ROLE_HIERARCHY[actorHighest] > ROLE_HIERARCHY[targetRole];
}

/**
 * Get display name for a role
 */
export function getRoleDisplayName(role: Role): string {
  const names: Record<Role, string> = {
    super_admin: 'Super Administrator',
    admin: 'Administrator',
    sales: 'Sales',
    content_admin: 'Content Admin',
    moderator: 'Moderator',
    support: 'Support Agent',
    business_premium: 'Business Premium',
    business_basic: 'Business Basic',
    user: 'User',
    guest: 'Guest',
  };
  return names[role] || role;
}

/**
 * Get role badge color for UI
 */
export function getRoleBadgeColor(role: Role): string {
  const colors: Record<Role, string> = {
    super_admin: 'bg-red-500',
    admin: 'bg-sky-500',
    sales: 'bg-emerald-500',
    content_admin: 'bg-indigo-500',
    moderator: 'bg-blue-500',
    support: 'bg-cyan-500',
    business_premium: 'bg-amber-500',
    business_basic: 'bg-orange-500',
    user: 'bg-emerald-500',
    guest: 'bg-gray-500',
  };
  return colors[role] || 'bg-gray-500';
}
