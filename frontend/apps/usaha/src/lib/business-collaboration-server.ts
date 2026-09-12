import 'server-only';

import { readAccessToken } from '@/lib/auth-session';
import {
  parseOrganizationInvitations,
  parseOrganizationMembers,
  type OrganizationInvitation,
  type OrganizationMember,
} from '@/lib/business-collaboration';
import { getBusinessForCurrentActor, UpstreamHttpError } from '@/lib/business-server';

const IDENTITY_URL =
  process.env.INTERNAL_API_URL ||
  process.env.INTERNAL_IDENTITY_URL ||
  'http://identity_service:8080';

async function requestIdentity(path: string, token: string): Promise<unknown> {
  const response = await fetch(`${IDENTITY_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
    cache: 'no-store',
  });
  const text = await response.text();
  let payload: unknown = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { error: text || 'Invalid Identity response' };
  }
  if (!response.ok) {
    const record = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
    const code = typeof record.error === 'string'
      ? record.error
      : typeof record.message === 'string'
        ? record.message
        : 'identity_request_failed';
    throw new UpstreamHttpError(response.status, code);
  }
  return payload;
}

async function resolveCollaborationContext(businessId: string) {
  const token = await readAccessToken();
  if (!token) throw new UpstreamHttpError(401, 'auth_required');

  const business = await getBusinessForCurrentActor(businessId);
  if (!business) throw new UpstreamHttpError(404, 'business_not_found');
  if (!business.organizationId) {
    throw new UpstreamHttpError(409, 'business_organization_not_linked');
  }
  return { token, business };
}

export async function listOrganizationMembersForBusiness(
  businessId: string,
): Promise<OrganizationMember[]> {
  const { token, business } = await resolveCollaborationContext(businessId);
  const payload = await requestIdentity(
    `/organizations/${encodeURIComponent(business.organizationId as string)}/members`,
    token,
  );
  return parseOrganizationMembers(payload);
}

export async function listOrganizationInvitationsForBusiness(
  businessId: string,
): Promise<OrganizationInvitation[]> {
  const { token, business } = await resolveCollaborationContext(businessId);
  const payload = await requestIdentity(
    `/organization-invitations?organization_id=${encodeURIComponent(business.organizationId as string)}`,
    token,
  );
  return parseOrganizationInvitations(payload);
}
