import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const API_BASE = 'http://identity:8080';
const CHAT_BASE = 'http://chat:4000';
const FLOW_PHONE = '081234567890';

type RecordedCall = { url: string; method: string; body?: unknown };

async function runIntegratedFlow(fetchImpl: typeof fetch): Promise<RecordedCall[]> {
  const calls: RecordedCall[] = [];
  const wrappedFetch: typeof fetch = async (input, init) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    const method = (init?.method || 'GET').toUpperCase();
    let body: unknown;

    if (init?.body && typeof init.body === 'string') {
      try {
        body = JSON.parse(init.body);
      } catch {
        body = init.body;
      }
    }

    calls.push({ url, method, body });
    return fetchImpl(input, init);
  };

  const registerRes = await wrappedFetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phone: FLOW_PHONE,
      full_name: 'Flow Test',
    }),
  });
  expect([200, 201]).toContain(registerRes.status);
  if (!registerRes.ok) throw new Error(`Register failed: ${registerRes.status}`);
  const registerData = await registerRes.json().catch(() => ({}));

  const loginRes = await wrappedFetch(`${API_BASE}/auth/login-phone`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phone: FLOW_PHONE,
    }),
  });
  expect([200, 201]).toContain(loginRes.status);
  if (!loginRes.ok) throw new Error(`Login failed: ${loginRes.status}`);
  const loginData = await loginRes.json().catch(() => ({}));
  const accessToken = loginData.access_token || registerData.access_token || 'mock-token';

  const peerUserId = '00000000-0000-0000-0000-000000000002';
  const dmRes = await wrappedFetch(`${CHAT_BASE}/api/v1/dm`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ peer_user_id: peerUserId }),
  });
  expect([200, 201]).toContain(dmRes.status);
  if (!dmRes.ok) throw new Error(`Create DM failed: ${dmRes.status}`);
  const dmData = await dmRes.json().catch(() => ({}));
  const roomId = dmData.data?.room_id || 'dm:mock:room';

  const msgRes = await wrappedFetch(`${CHAT_BASE}/api/v1/rooms/${roomId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ content: 'Hello from flow test' }),
  });
  expect([200, 201]).toContain(msgRes.status);
  if (!msgRes.ok) throw new Error(`Send message failed: ${msgRes.status}`);

  return calls;
}

describe('Integrated flow: phone register -> phone login -> DM -> message', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    mockFetch.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : (input as Request).url;
      const method = (init?.method || 'GET').toUpperCase();

      if (url.includes('/auth/register') && method === 'POST') {
        return Promise.resolve(
          new Response(
            JSON.stringify({ message: 'ok', user: { id: '1', phone: FLOW_PHONE } }),
            { status: 200 },
          ),
        );
      }
      if (url.includes('/auth/login-phone') && method === 'POST') {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              access_token: 'mock-jwt-token',
              token_type: 'Bearer',
              expires_in: 3600,
              refresh_token: 'mock-refresh',
              session_id: '00000000-0000-0000-0000-000000000001',
            }),
            { status: 200 },
          ),
        );
      }
      if (url.includes('/api/v1/dm') && method === 'POST') {
        return Promise.resolve(
          new Response(JSON.stringify({ data: { room_id: 'dm:user1:user2' } }), {
            status: 200,
          }),
        );
      }
      if (url.includes('/api/v1/rooms/') && url.includes('/messages') && method === 'POST') {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              data: {
                room_id: 'dm:user1:user2',
                content: 'Hello from flow test',
                sent_at: new Date().toISOString(),
              },
            }),
            { status: 201 },
          ),
        );
      }
      return Promise.resolve(
        new Response(JSON.stringify({ error: 'not mocked' }), { status: 404 }),
      );
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls register then phone login then create DM then send message in order', async () => {
    const calls = await runIntegratedFlow(mockFetch);

    expect(calls.length).toBe(4);

    expect(calls[0].method).toBe('POST');
    expect(calls[0].url).toContain('/auth/register');
    expect((calls[0].body as { phone?: string })?.phone).toBe(FLOW_PHONE);

    expect(calls[1].method).toBe('POST');
    expect(calls[1].url).toContain('/auth/login-phone');
    expect((calls[1].body as { phone?: string })?.phone).toBe(FLOW_PHONE);

    expect(calls[2].method).toBe('POST');
    expect(calls[2].url).toContain('/api/v1/dm');
    expect((calls[2].body as { peer_user_id?: string })?.peer_user_id).toBeDefined();

    expect(calls[3].method).toBe('POST');
    expect(calls[3].url).toMatch(/\/api\/v1\/rooms\/.+\/messages/);
    expect((calls[3].body as { content?: string })?.content).toBe(
      'Hello from flow test',
    );
  });

  it('flow completes without throwing', async () => {
    await expect(runIntegratedFlow(mockFetch)).resolves.toHaveLength(4);
  });
});
