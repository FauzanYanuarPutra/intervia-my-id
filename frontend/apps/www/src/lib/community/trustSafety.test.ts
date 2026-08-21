import { describe, expect, it, vi } from 'vitest';
import {
  isSameCommunityUser,
  markReelNotInterested,
  setCommunityUserBlocked,
  submitTrustReport,
} from './trustSafety';

describe('community trust safety client', () => {
  it('submits a reel report and returns the server receipt', async () => {
    const authFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          reportId: 'report_123',
          status: 'open',
          message: 'received',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await expect(
      submitTrustReport(authFetch, 'reel', 'reel/1', {
        reason: 'scam',
        details: '  misleading price  ',
      }),
    ).resolves.toEqual({
      reportId: 'report_123',
      status: 'open',
      message: 'received',
    });
    expect(authFetch).toHaveBeenCalledWith(
      '/api/reels/reel%2F1/report',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ reason: 'scam', details: 'misleading price' }),
      }),
    );
  });

  it('persists not-interested and user-block actions through canonical APIs', async () => {
    const authFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await markReelNotInterested(authFetch, 'reel 7');
    await setCommunityUserBlocked(authFetch, 'auth-user/7');

    expect(authFetch.mock.calls[0]?.[0]).toBe('/api/reels/reel%207/actions');
    expect(authFetch.mock.calls[1]?.[0]).toBe(
      '/api/community/users/auth-user%2F7/block',
    );
  });

  it('surfaces API errors and normalizes forum identity ids', async () => {
    const authFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'rate limited' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(
      submitTrustReport(authFetch, 'thread', 'thread-1', { reason: 'spam' }),
    ).rejects.toThrow('rate limited');
    expect(isSameCommunityUser('auth-ABC', 'abc')).toBe(true);
    expect(isSameCommunityUser('auth-ABC', 'def')).toBe(false);
  });
});
