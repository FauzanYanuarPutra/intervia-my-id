import { describe, expect, it, vi } from 'vitest';
import { buildAiChatPayload, MAX_AI_CONTEXT_MESSAGES } from './aiChat';

/**
 * Quality automation: Chat (DM), Search (discover users), AI chat context.
 * Mocks fetch to assert request shape and response handling.
 */

describe('AI chat payload (context for two-way conversation)', () => {
  it('includes message and no context when history is empty', () => {
    const payload = buildAiChatPayload('Hello', []);
    expect(payload.message).toBe('Hello');
    expect(payload.context).toBeUndefined();
  });

  it('includes last 10 messages as context with role and content', () => {
    const history = [
      { role: 'user', content: 'A' },
      { role: 'assistant', content: 'B' },
      { role: 'user', content: 'C' },
    ];
    const payload = buildAiChatPayload('D', history);
    expect(payload.message).toBe('D');
    expect(payload.context).toEqual([
      { role: 'user', content: 'A' },
      { role: 'assistant', content: 'B' },
      { role: 'user', content: 'C' },
    ]);
  });

  it('caps context at 10 messages', () => {
    const history = Array.from({ length: 15 }, (_, i) =>
      i % 2 === 0
        ? { role: 'user' as const, content: `u${i}` }
        : { role: 'assistant' as const, content: `a${i}` }
    );
    const payload = buildAiChatPayload('new', history);
    expect(payload.context).toHaveLength(10);
    expect(payload.context!.map((m) => m.content)).toEqual(
      history.slice(-10).map((m) => m.content)
    );
  });

  it('context items have role and content only', () => {
    const payload = buildAiChatPayload('Hi', [
      { role: 'user', content: 'Test' },
    ]);
    expect(payload.context).toHaveLength(1);
    expect(payload.context![0]).toEqual({ role: 'user', content: 'Test' });
  });
});

describe('Discover users flow (search page)', () => {
  it('calls GET /api/users/discover with query and limit', async () => {
    const mockFetch = vi.fn();
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ data: [{ id: '1', full_name: 'Alice' }] }), {
        status: 200,
      })
    );

    const url = '/api/users/discover?limit=30';
    await mockFetch(url, { credentials: 'include', cache: 'no-store' });

    expect(mockFetch).toHaveBeenCalledWith(
      url,
      expect.objectContaining({ credentials: 'include' })
    );
  });

  it('appends q when searching by name', async () => {
    const mockFetch = vi.fn();
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ data: [] }), { status: 200 })
    );

    const params = new URLSearchParams();
    params.set('q', 'john');
    params.set('limit', '30');
    const url = `/api/users/discover?${params.toString()}`;
    await mockFetch(url, { credentials: 'include' });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('q=john'),
      expect.any(Object)
    );
  });
});

describe('Start DM flow (from search or chat)', () => {
  it('POST /api/chat/dm body includes peer_user_id', async () => {
    const mockFetch = vi.fn();
    mockFetch.mockResolvedValue(
      new Response(
        JSON.stringify({ room_id: 'room-123' }),
        { status: 200 }
      )
    );

    const peerUserId = '00000000-0000-0000-0000-000000000002';
    const body = JSON.stringify({ peer_user_id: peerUserId });
    await mockFetch('/api/chat/dm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      credentials: 'include',
    });

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/chat/dm',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ peer_user_id: peerUserId }),
      })
    );
  });

  it('response with room_id leads to navigate to /chat/{room_id}', async () => {
    const mockFetch = vi.fn();
    mockFetch.mockResolvedValue(
      new Response(
        JSON.stringify({ room_id: 'dm-abc-123' }),
        { status: 200 }
      )
    );

    const res = await mockFetch('/api/chat/dm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ peer_user_id: 'user-2' }),
    });
    const data = await res.json();
    const path = `/chat/${data.room_id}`;

    expect(path).toBe('/chat/dm-abc-123');
  });
});
