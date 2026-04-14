// lib/users.ts
// Service for fetching users from the backend Identity service

export interface User {
  id: string;
  email: string;
  username?: string;
  avatarUrl?: string;
  roles?: string[];
  created_at?: string;
}

export interface UsersResponse {
  data: User[];
  total?: number;
  page?: number;
  limit?: number;
}

/**
 * Fetch list of users from backend
 * @param options - Query options (search, limit, offset)
 * @returns Promise<UsersResponse>
 */
export async function fetchUsers(options?: {
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<UsersResponse> {
  const params = new URLSearchParams();
  if (options?.search) params.set('search', options.search);
  if (options?.limit) params.set('limit', String(options.limit));
  if (options?.offset) params.set('offset', String(options.offset));

  const res = await fetch(`/api/users?${params.toString()}`, {
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error('Failed to fetch users');
  }

  return res.json();
}

/**
 * Fetch single user by ID
 * @param id - User ID
 * @returns Promise<User>
 */
export async function fetchUserById(id: string): Promise<User> {
  const res = await fetch(`/api/users/${id}`, {
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error('Failed to fetch user');
  }

  return res.json();
}

/**
 * Create or get a DM room with another user
 * @param peerUserId - The other user's ID
 * @returns Promise<{ room_id: string }>
 */
export async function createOrGetDmRoom(peerUserId: string): Promise<{ room_id: string }> {
  const res = await fetch('/api/chat/dm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ peer_user_id: peerUserId }),
  });

  if (!res.ok) {
    throw new Error('Failed to create DM room');
  }

  const data = await res.json();
  return data.data || data;
}
