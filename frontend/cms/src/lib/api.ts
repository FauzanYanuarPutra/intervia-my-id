// CMS API Client
// Handles all API calls to backend services

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
const MARKETPLACE_URL = process.env.NEXT_PUBLIC_MARKETPLACE_URL || 'http://localhost:8081';

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

async function fetchWithAuth<T = any>(url: string, options: FetchOptions = {}): Promise<T> {
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
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json() as Promise<T>;
}

// Auth API
export const authApi = {
  login: async (email: string, password: string): Promise<AuthLoginResponse> => {
    const res = await fetchWithAuth<any>(`${API_URL}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    const roles = Array.isArray(res?.roles)
      ? res.roles.map((r: unknown) => String(r))
      : Array.isArray(res?.user?.roles)
      ? res.user.roles.map((r: unknown) => String(r))
      : [];

    return {
      access_token: String(res?.access_token || ''),
      refresh_token: String(res?.refresh_token || ''),
      session_id: String(res?.session_id || ''),
      roles,
      user: res?.user,
    };
  },

  logout: async (token: string) => {
    return fetchWithAuth(`${API_URL}/auth/logout`, {
      method: 'POST',
      token,
    });
  },

  me: async (token: string) => {
    return fetchWithAuth(`${API_URL}/auth/me`, {
      method: 'GET',
      token,
    });
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

  create: async (token: string, data: Record<string, any>) => {
    return fetchWithAuth(`${MARKETPLACE_URL}/v1/content`, {
      method: 'POST',
      token,
      body: JSON.stringify(data),
    });
  },

  update: async (token: string, id: string, data: Record<string, any>) => {
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

  create: async (token: string, data: Record<string, any>) => {
    return fetchWithAuth(`${MARKETPLACE_URL}/v1/sectors`, {
      method: 'POST',
      token,
      body: JSON.stringify(data),
    });
  },

  update: async (token: string, id: string, data: Record<string, any>) => {
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

  create: async (token: string, data: Record<string, any>) => {
    return fetchWithAuth(`${MARKETPLACE_URL}/v1/banners`, {
      method: 'POST',
      token,
      body: JSON.stringify(data),
    });
  },

  update: async (token: string, id: string, data: Record<string, any>) => {
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
