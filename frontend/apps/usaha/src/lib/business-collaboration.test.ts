import { describe, expect, it } from 'vitest';
import {
  groupBusinessesByRelationship,
  invitationStatusLabel,
  organizationRoleLabel,
} from './business-collaboration';
import type { BusinessRecord } from './portal-types';

function business(
  id: string,
  relationship: 'owned' | 'joined',
  role: BusinessRecord['currentRole'],
): BusinessRecord {
  return {
    id,
    relationship,
    slug: id,
    name: id,
    currentRole: role,
    city: 'Tangerang Selatan',
    address: '',
    latitude: null,
    longitude: null,
    locationQuery: '',
    googleMapsUrl: '',
    category: 'Usaha umum',
    phone: '',
    description: '',
    schedule: 'Belum diatur',
    infoComplete: false,
    productsCount: 0,
    isOpen: false,
    buyerPageReady: false,
    activeOrders: 0,
    reservationsCount: 0,
    teamMembers: [],
    invites: [],
    products: [],
    orders: [],
    reservations: [],
    permissions: [],
    publicUrl: '',
    securityEvents: [],
  };
}

describe('business collaboration presentation', () => {
  it('separates owned and joined businesses without changing roles', () => {
    const grouped = groupBusinessesByRelationship([
      business('joined-manager', 'joined', 'manager'),
      business('mine', 'owned', 'owner'),
      business('joined-cashier', 'joined', 'cashier'),
    ]);

    expect(grouped.owned.map(item => item.id)).toEqual(['mine']);
    expect(grouped.joined.map(item => item.id)).toEqual([
      'joined-manager',
      'joined-cashier',
    ]);
    expect(grouped.joined[0]?.currentRole).toBe('manager');
  });

  it('uses human Indonesian role labels', () => {
    expect(organizationRoleLabel('org_admin')).toBe('Admin usaha');
    expect(organizationRoleLabel('org_manager')).toBe('Manager');
    expect(organizationRoleLabel('org_cashier')).toBe('Kasir');
    expect(organizationRoleLabel('org_viewer')).toBe('Pantau');
  });

  it('uses human Indonesian invitation status labels', () => {
    expect(invitationStatusLabel('pending')).toBe('Menunggu');
    expect(invitationStatusLabel('accepted')).toBe('Diterima');
    expect(invitationStatusLabel('rejected')).toBe('Ditolak');
    expect(invitationStatusLabel('expired')).toBe('Kedaluwarsa');
  });
});
