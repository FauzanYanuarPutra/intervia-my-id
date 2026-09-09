import { describe, expect, it } from 'vitest';
import { normalizeWorkspaceRole } from './business-role';

describe('normalizeWorkspaceRole', () => {
  it('maps Identity organization sales roles to Usaha permissions', () => {
    expect(normalizeWorkspaceRole('org_admin', false)).toBe('manager');
    expect(normalizeWorkspaceRole('org_manager', false)).toBe('manager');
    expect(normalizeWorkspaceRole('org_cashier', false)).toBe('cashier');
    expect(normalizeWorkspaceRole('org_viewer', false)).toBe('viewer');
  });

  it('keeps the organization owner as owner', () => {
    expect(normalizeWorkspaceRole('org_viewer', true)).toBe('owner');
  });
});
