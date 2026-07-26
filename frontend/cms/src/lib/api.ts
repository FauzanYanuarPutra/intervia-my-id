// CMS API Client
// Handles all API calls to backend services

const API_URL = process.env.NEXT_PUBLIC_CMS_AUTH_API_URL || '/api';
const MARKETPLACE_URL =
  process.env.NEXT_PUBLIC_CMS_MARKETPLACE_API_URL || '/api/marketplace';

type FetchOptions = RequestInit & {
  token?: string;
};

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

type ApiRecord = Record<string, unknown>;

function readRecord(value: unknown): ApiRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as ApiRecord;
}

async function fetchWithAuth<T = unknown>(url: string, options: FetchOptions = {}): Promise<T> {
  const { token, ...fetchOptions } = options;
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...fetchOptions,
    headers,
  });

  if (!response.ok) {
    const error = readRecord(
      await response.json().catch(() => ({ message: 'Request failed' })),
    );
    const message =
      typeof error.message === 'string'
        ? error.message
        : typeof error.error === 'string'
          ? error.error
          : `HTTP ${response.status}`;
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

// Auth API
export const authApi = {
  login: async (email: string, password: string): Promise<AuthLoginResponse> => {
    const res = await fetchWithAuth<ApiRecord>(`${API_URL}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    const userRecord = readRecord(res.user);

    const roles = Array.isArray(res?.roles)
      ? res.roles.map((r: unknown) => String(r))
      : Array.isArray(userRecord.roles)
      ? userRecord.roles.map((r: unknown) => String(r))
      : [];

    return {
      access_token: String(res?.access_token || ''),
      refresh_token: String(res?.refresh_token || ''),
      session_id: String(res?.session_id || ''),
      roles,
      user:
        typeof userRecord.id === 'string'
          ? {
              id: userRecord.id,
              roles: Array.isArray(userRecord.roles)
                ? userRecord.roles.map((role: unknown) => String(role))
                : undefined,
            }
          : undefined,
    };
  },

  logout: async (token: string) => {
    return fetchWithAuth(`${API_URL}/auth/logout`, {
      method: 'POST',
      token,
    });
  },

  me: async (token: string): Promise<AuthMeResponse> => {
    const payload = await fetchWithAuth<ApiRecord>(`${API_URL}/auth/me`, {
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
    return fetchWithAuth(`${API_URL}/auth/refresh`, {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken, session_id: sessionId }),
    });
  },
};

// Content API (Marketplace Service)
export const contentApi = {
  list: async (token: string, params: Record<string, string> = {}) => {
    const query = new URLSearchParams(params).toString();
    return fetchWithAuth(`${MARKETPLACE_URL}/v1/content?${query}`, {
      method: 'GET',
      token,
    });
  },

  get: async (token: string, id: string) => {
    return fetchWithAuth(`${MARKETPLACE_URL}/v1/content/${id}`, {
      method: 'GET',
      token,
    });
  },

  create: async (token: string, data: Record<string, unknown>) => {
    return fetchWithAuth(`${MARKETPLACE_URL}/v1/content`, {
      method: 'POST',
      token,
      body: JSON.stringify(data),
    });
  },

  update: async (token: string, id: string, data: Record<string, unknown>) => {
    return fetchWithAuth(`${MARKETPLACE_URL}/v1/content/${id}`, {
      method: 'PATCH',
      token,
      body: JSON.stringify(data),
    });
  },

  delete: async (token: string, id: string) => {
    return fetchWithAuth(`${MARKETPLACE_URL}/v1/content/${id}`, {
      method: 'PATCH',
      token,
      body: JSON.stringify({ content_status: 'deleted' }),
    });
  },
};

// Sector API
export const sectorApi = {
  list: async (token: string, params: Record<string, string> = {}) => {
    const query = new URLSearchParams(params).toString();
    const url = query ? `${MARKETPLACE_URL}/v1/sectors?${query}` : `${MARKETPLACE_URL}/v1/sectors`;
    return fetchWithAuth(url, {
      method: 'GET',
      token,
    });
  },

  create: async (token: string, data: Record<string, unknown>) => {
    return fetchWithAuth(`${MARKETPLACE_URL}/v1/sectors`, {
      method: 'POST',
      token,
      body: JSON.stringify(data),
    });
  },

  update: async (token: string, id: string, data: Record<string, unknown>) => {
    return fetchWithAuth(`${MARKETPLACE_URL}/v1/sectors/${id}`, {
      method: 'PATCH',
      token,
      body: JSON.stringify(data),
    });
  },

  delete: async (token: string, id: string) => {
    return fetchWithAuth(`${MARKETPLACE_URL}/v1/sectors/${id}`, {
      method: 'DELETE',
      token,
    });
  },
};

// Banner API
export const bannerApi = {
  list: async (token: string, params: Record<string, string> = {}) => {
    const query = new URLSearchParams(params).toString();
    const url = query ? `${MARKETPLACE_URL}/v1/banners?${query}` : `${MARKETPLACE_URL}/v1/banners`;
    return fetchWithAuth(url, {
      method: 'GET',
      token,
    });
  },

  create: async (token: string, data: Record<string, unknown>) => {
    return fetchWithAuth(`${MARKETPLACE_URL}/v1/banners`, {
      method: 'POST',
      token,
      body: JSON.stringify(data),
    });
  },

  update: async (token: string, id: string, data: Record<string, unknown>) => {
    return fetchWithAuth(`${MARKETPLACE_URL}/v1/banners/${id}`, {
      method: 'PATCH',
      token,
      body: JSON.stringify(data),
    });
  },

  delete: async (token: string, id: string) => {
    return fetchWithAuth(`${MARKETPLACE_URL}/v1/banners/${id}`, {
      method: 'DELETE',
      token,
    });
  },
};
