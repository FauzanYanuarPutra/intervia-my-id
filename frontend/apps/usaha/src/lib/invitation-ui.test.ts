import { describe, expect, it } from 'vitest';
import {
  activeInvitationCount,
  invitationExpiryLabel,
  parsePendingInvitations,
} from './invitation-ui';

describe('invitation UI contract', () => {
  it('parses pending organization invitations from the Identity envelope', () => {
    const invitations = parsePendingInvitations({
      data: {
        items: [
          {
            id: 'invite-1',
            org_id: 'org-1',
            organization_name: 'Lajukan Juice',
            role: 'org_cashier',
            status: 'pending',
            expires_at: '2026-09-15T12:00:00Z',
          },
        ],
      },
    });

    expect(invitations).toEqual([
      expect.objectContaining({
        id: 'invite-1',
        organizationId: 'org-1',
        organizationName: 'Lajukan Juice',
        role: 'org_cashier',
      }),
    ]);
  });

  it('counts only pending invitations for the global badge', () => {
    expect(
      activeInvitationCount([
        { id: '1', organizationId: 'a', organizationName: 'A', role: 'org_manager', status: 'pending', expiresAt: '' },
        { id: '2', organizationId: 'b', organizationName: 'B', role: 'org_viewer', status: 'accepted', expiresAt: '' },
      ]),
    ).toBe(1);
  });

  it('formats invitation expiry in Indonesian without exposing raw timestamps', () => {
    expect(invitationExpiryLabel('2026-09-15T12:00:00Z', 'id-ID')).toContain('15');
    expect(invitationExpiryLabel('', 'id-ID')).toBe('Masa berlaku tidak tersedia');
  });
});
