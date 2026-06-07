const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
const CRM_AUTH_API_URL = process.env.NEXT_PUBLIC_CRM_AUTH_API_URL || '/api';
const MARKETPLACE_URL =
  process.env.NEXT_PUBLIC_MARKETPLACE_URL || 'http://localhost:8081';

type FetchOptions = RequestInit & {
  token?: string;
};

type JsonRecord = Record<string, unknown>;

type AuthLoginResponse = {
  access_token: string;
  refresh_token: string;
  session_id: string;
  roles: string[];
  user?: {
    id: string;
    roles?: string[];
  };
};

export type AuthMeResponse = {
  id: string;
  email: string;
  username?: string;
  roles: string[];
};

export type OtpSendResponse = {
  success: boolean;
  message?: string;
  purpose?: string;
  devOtp?: string;
  delivery?: string;
};

export type OtpVerifyResponse = {
  success: boolean;
  verified: boolean;
  type: 'email' | 'phone';
  target: string;
  purpose: string;
  token: string;
  expiresIn: number;
};

export type SupportTicket = {
  id: string;
  requester_user_id: string | null;
  requester_email: string;
  requester_name: string | null;
  category: string;
  subject: string;
  status: string;
  priority: string;
  assigned_agent_id: string | null;
  support_room_id: string | null;
  source: string;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  first_response_at: string | null;
  latest_message: string | null;
  latest_message_at: string | null;
};

export type SupportReply = {
  id: string;
  ticket_id: string;
  author_user_id: string | null;
  author_role: string;
  body: string;
  is_internal: boolean;
  created_at: string;
};

export type SupportTicketDetail = {
  ticket: SupportTicket;
  replies: SupportReply[];
};

export type CrmLead = {
  id: string;
  requester_user_id: string | null;
  requester_email: string | null;
  requester_name: string | null;
  owner_id: string | null;
  contact_user_id: string | null;
  content_id: string | null;
  chat_room_id: string | null;
  name: string;
  sector: string | null;
  stage: string;
  source: string;
  value_cents: number | null;
  currency: string | null;
  metadata: JsonRecord;
  created_at: string;
  updated_at: string;
};

export type CrmActivity = {
  id: string;
  lead_id: string;
  actor_user_id: string | null;
  actor_role: string;
  action: string;
  message: string;
  metadata: JsonRecord;
  created_at: string;
};

export type SuperAppOrder = {
  id: string;
  requester_id: string;
  partner_id: string | null;
  merchant_id: string | null;
  provider_id: string | null;
  service_type: string;
  status: string;
  payment_mode: string;
  currency: string;
  amount_estimate_cents: number;
  amount_final_cents: number;
  pickup_address: string | null;
  pickup_lat: number | null;
  pickup_lng: number | null;
  dropoff_address: string | null;
  dropoff_lat: number | null;
  dropoff_lng: number | null;
  risk_score: number;
  risk_flags: unknown;
  metadata: JsonRecord;
  created_at: string;
  updated_at: string;
};

export type SuperAppTrustTier =
  | 'rookie'
  | 'verified'
  | 'trusted_pro'
  | 'elite'
  | 'influencer'
  | 'enterprise';

export type SuperAppKycStatus = 'none' | 'basic' | 'full' | 'enhanced';
export type SuperAppCrmApprovalStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'restricted';

export type SuperAppTrustProfile = {
  user_id: string;
  tier: SuperAppTrustTier;
  kyc_status: SuperAppKycStatus;
  crm_approval_status: SuperAppCrmApprovalStatus;
  marketing_segment: string;
  manual_hold: boolean;
  manual_per_order_cap_cents: number | null;
  manual_daily_cap_cents: number | null;
  manual_monthly_cap_cents: number | null;
  legal_terms_version: string | null;
  legal_terms_accepted_at: string | null;
  risk_strike_count: number;
  metadata: JsonRecord;
  created_at: string;
  updated_at: string;
};

export type SuperAppOrderDetail = {
  order: SuperAppOrder;
  events: Array<{
    id: number;
    order_id: string;
    actor_id: string | null;
    actor_role: string;
    event_type: string;
    payload: JsonRecord;
    created_at: string;
  }>;
};

export type IdentityPublicProfile = {
  id: string;
  username?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  location?: string | null;
  headline?: string | null;
  roles?: string[];
  metadata_roles?: unknown;
  level?: string | null;
  rating?: number | null;
  completed_jobs?: number | null;
  hourly_rate?: number | null;
  freelancer_profile?: unknown;
  provider_profile?: unknown;
  buyer_profile?: unknown;
  email_verified: boolean;
  phone_verified: boolean;
  document_verified: boolean;
  liveness_verified: boolean;
  identity_verified: boolean;
  transaction_eligible: boolean;
  kyc_status: string;
  verification: JsonRecord;
};

function readErrorMessage(
  responseText: string,
  payload: unknown,
  status: number,
): string {
  if (
    payload &&
    typeof payload === 'object' &&
    !Array.isArray(payload) &&
    (typeof (payload as JsonRecord).error === 'string' ||
      typeof (payload as JsonRecord).message === 'string')
  ) {
    return String(
      (payload as JsonRecord).error || (payload as JsonRecord).message,
    );
  }

  const trimmed = responseText.trim();
  return trimmed || `HTTP ${status}`;
}

async function fetchJson<T = unknown>(
  url: string,
  options: FetchOptions = {},
): Promise<T> {
  const { token, headers: incomingHeaders, ...fetchOptions } = options;
  const headers = new Headers(incomingHeaders || {});

  if (!headers.has('Content-Type') && fetchOptions.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...fetchOptions,
      headers,
    });
  } catch {
    throw new Error(
      'Service belum tersambung. Pastikan CRM, identity, dan marketplace service aktif.',
    );
  }

  const responseText = await response.text();
  let payload: unknown = null;
  try {
    payload = responseText ? (JSON.parse(responseText) as unknown) : null;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new Error(readErrorMessage(responseText, payload, response.status));
  }

  return (payload ?? {}) as T;
}

export const authApi = {
  login: async (email: string, password: string): Promise<AuthLoginResponse> => {
    const payload = await fetchJson<JsonRecord>(`${CRM_AUTH_API_URL}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    const user = payload.user as JsonRecord | undefined;
    const userRoles = Array.isArray(user?.roles)
      ? user.roles.map(role => String(role))
      : [];
    const roles = Array.isArray(payload.roles)
      ? payload.roles.map(role => String(role))
      : userRoles;

    return {
      access_token: String(payload.access_token || ''),
      refresh_token: String(payload.refresh_token || ''),
      session_id: String(payload.session_id || ''),
      roles,
      user: user
        ? {
            id: String(user.id || ''),
            roles: userRoles,
          }
        : undefined,
    };
  },

  logout: async (token: string) => {
    return fetchJson(`${CRM_AUTH_API_URL}/auth/logout`, {
      method: 'POST',
      token,
    });
  },

  me: async (token: string): Promise<AuthMeResponse> => {
    const payload = await fetchJson<JsonRecord>(`${CRM_AUTH_API_URL}/auth/me`, {
      method: 'GET',
      token,
    });

    return {
      id: String(payload.id || ''),
      email: String(payload.email || ''),
      username:
        typeof payload.username === 'string' ? payload.username : undefined,
      roles: Array.isArray(payload.roles)
        ? payload.roles.map(role => String(role))
        : [],
    };
  },

  refresh: async (refreshToken: string, sessionId: string) => {
    return fetchJson(`${CRM_AUTH_API_URL}/auth/refresh`, {
      method: 'POST',
      body: JSON.stringify({
        refresh_token: refreshToken,
        session_id: sessionId,
      }),
    });
  },
};

export const securityApi = {
  sendOtp: async (
    target: string,
    purpose: 'register' | 'login' | 'reset' = 'login',
  ): Promise<OtpSendResponse> => {
    return fetchJson<OtpSendResponse>('/api/auth/send-otp', {
      method: 'POST',
      body: JSON.stringify({
        type: 'email',
        target,
        purpose,
      }),
    });
  },

  verifyOtp: async (
    target: string,
    otp: string,
    purpose: 'register' | 'login' | 'reset' = 'login',
  ): Promise<OtpVerifyResponse> => {
    return fetchJson<OtpVerifyResponse>('/api/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({
        type: 'email',
        target,
        otp,
        purpose,
      }),
    });
  },
};

export const leadApi = {
  list: async (token: string, params: Record<string, string> = {}) => {
    const query = new URLSearchParams(params).toString();
    return fetchJson<{ items: CrmLead[] }>(
      `${MARKETPLACE_URL}/v1/crm/leads${query ? `?${query}` : ''}`,
      {
        method: 'GET',
        token,
      },
    );
  },

  get: async (token: string, id: string) => {
    return fetchJson<{ lead: CrmLead }>(
      `${MARKETPLACE_URL}/v1/crm/leads/${encodeURIComponent(id)}`,
      {
        method: 'GET',
        token,
      },
    );
  },

  create: async (
    token: string,
    data: Record<string, unknown>,
  ): Promise<{ lead: CrmLead }> => {
    return fetchJson<{ lead: CrmLead }>(`${MARKETPLACE_URL}/v1/crm/leads`, {
      method: 'POST',
      token,
      body: JSON.stringify(data),
    });
  },

  update: async (
    token: string,
    id: string,
    data: Record<string, unknown>,
  ): Promise<{ lead: CrmLead }> => {
    return fetchJson<{ lead: CrmLead }>(
      `${MARKETPLACE_URL}/v1/crm/leads/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        token,
        body: JSON.stringify(data),
      },
    );
  },

  delete: async (token: string, id: string) => {
    return fetchJson<{ lead: CrmLead }>(
      `${MARKETPLACE_URL}/v1/crm/leads/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        token,
        body: JSON.stringify({ stage: 'lost' }),
      },
    );
  },

  updateStage: async (token: string, id: string, stage: string) => {
    return fetchJson<{ lead: CrmLead }>(
      `${MARKETPLACE_URL}/v1/crm/leads/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        token,
        body: JSON.stringify({ stage }),
      },
    );
  },
};

export const activityApi = {
  list: async (token: string, params: Record<string, string> = {}) => {
    const query = new URLSearchParams(params).toString();
    return fetchJson<{ items: CrmActivity[] }>(
      `${MARKETPLACE_URL}/v1/crm/activities${query ? `?${query}` : ''}`,
      {
        method: 'GET',
        token,
      },
    );
  },

  create: async () => ({ success: true }),
};

export const supportApi = {
  create: async (
    token: string,
    data: {
      requester_email: string;
      requester_name?: string | null;
      category?: string;
      subject: string;
      message: string;
      priority?: string;
      source?: string;
    },
  ) => {
    return fetchJson(`${MARKETPLACE_URL}/v1/support/tickets`, {
      method: 'POST',
      token,
      body: JSON.stringify(data),
    });
  },

  list: async (token: string, params: Record<string, string> = {}) => {
    const query = new URLSearchParams(params).toString();
    return fetchJson<{ items: SupportTicket[] }>(
      `${MARKETPLACE_URL}/v1/support/tickets${query ? `?${query}` : ''}`,
      {
        method: 'GET',
        token,
      },
    );
  },

  get: async (token: string, id: string): Promise<SupportTicketDetail> => {
    return fetchJson<SupportTicketDetail>(
      `${MARKETPLACE_URL}/v1/support/tickets/${encodeURIComponent(id)}`,
      {
        method: 'GET',
        token,
      },
    );
  },

  update: async (
    token: string,
    id: string,
    data: {
      status?: string;
      priority?: string;
      assigned_agent_id?: string | null;
    },
  ) => {
    return fetchJson(
      `${MARKETPLACE_URL}/v1/support/tickets/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        token,
        body: JSON.stringify(data),
      },
    );
  },

  reply: async (
    token: string,
    id: string,
    data: {
      body: string;
      is_internal?: boolean;
    },
  ) => {
    return fetchJson(
      `${MARKETPLACE_URL}/v1/support/tickets/${encodeURIComponent(id)}/replies`,
      {
        method: 'POST',
        token,
        body: JSON.stringify(data),
      },
    );
  },
};

export const superAppApi = {
  listOrders: async (token: string, params: Record<string, string> = {}) => {
    const query = new URLSearchParams(params).toString();
    return fetchJson<{ items: SuperAppOrder[] }>(
      `${MARKETPLACE_URL}/v1/super-app/orders${query ? `?${query}` : ''}`,
      {
        method: 'GET',
        token,
      },
    );
  },

  getOrder: async (token: string, id: string): Promise<SuperAppOrderDetail> => {
    return fetchJson<SuperAppOrderDetail>(
      `${MARKETPLACE_URL}/v1/super-app/orders/${encodeURIComponent(id)}`,
      {
        method: 'GET',
        token,
      },
    );
  },

  updateOrder: async (
    token: string,
    id: string,
    data: {
      status?: string;
      partner_id?: string | null;
      amount_final_cents?: number;
      metadata?: Record<string, unknown>;
      event_type?: string;
      note?: string;
    },
  ) => {
    return fetchJson<{ order: SuperAppOrder }>(
      `${MARKETPLACE_URL}/v1/super-app/orders/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        token,
        body: JSON.stringify(data),
      },
    );
  },

  listTrustProfiles: async (
    token: string,
    params: Record<string, string> = {},
  ) => {
    const query = new URLSearchParams(params).toString();
    return fetchJson<{ items: SuperAppTrustProfile[] }>(
      `${MARKETPLACE_URL}/v1/super-app/trust-profiles${query ? `?${query}` : ''}`,
      {
        method: 'GET',
        token,
      },
    );
  },

  getTrustProfile: async (
    token: string,
    userId: string,
  ): Promise<{ profile: SuperAppTrustProfile }> => {
    return fetchJson<{ profile: SuperAppTrustProfile }>(
      `${MARKETPLACE_URL}/v1/super-app/trust-profiles/${encodeURIComponent(userId)}`,
      {
        method: 'GET',
        token,
      },
    );
  },

  upsertTrustProfile: async (
    token: string,
    userId: string,
    data: {
      tier?: SuperAppTrustTier;
      kyc_status?: SuperAppKycStatus;
      crm_approval_status?: SuperAppCrmApprovalStatus;
      marketing_segment?: string;
      manual_hold?: boolean;
      manual_per_order_cap_cents?: number | null;
      manual_daily_cap_cents?: number | null;
      manual_monthly_cap_cents?: number | null;
      risk_strike_count?: number;
      metadata?: Record<string, unknown>;
    },
  ) => {
    return fetchJson<{ profile: SuperAppTrustProfile }>(
      `${MARKETPLACE_URL}/v1/super-app/trust-profiles/${encodeURIComponent(userId)}`,
      {
        method: 'PUT',
        token,
        body: JSON.stringify(data),
      },
    );
  },
};

export const identityApi = {
  getPublicProfile: async (userId: string): Promise<IdentityPublicProfile> => {
    return fetchJson<IdentityPublicProfile>(
      `${API_URL}/users/public/${encodeURIComponent(userId)}`,
      {
        method: 'GET',
      },
    );
  },
};

export const usersApi = {
  list: async (token: string) => {
    return fetchJson(`${API_URL}/users`, {
      method: 'GET',
      token,
    });
  },
};
