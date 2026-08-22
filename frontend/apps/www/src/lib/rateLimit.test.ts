import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const redisEvalMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/redis', () => ({
  getRedis: () => ({ eval: redisEvalMock }),
}));

describe('rate limiting availability policy', () => {
  const originalFailOpen = process.env.RATE_LIMIT_FAIL_OPEN;

  beforeEach(() => {
    vi.resetModules();
    redisEvalMock.mockReset();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalFailOpen === undefined) {
      delete process.env.RATE_LIMIT_FAIL_OPEN;
    } else {
      process.env.RATE_LIMIT_FAIL_OPEN = originalFailOpen;
    }
  });

  it('fails closed when Redis is unavailable even if a legacy override requests fail-open', async () => {
    process.env.RATE_LIMIT_FAIL_OPEN = 'true';
    redisEvalMock.mockRejectedValueOnce(new Error('redis unavailable'));

    const { enforceRateLimit } = await import('./rateLimit');
    const result = await enforceRateLimit('login:test', 5, 60);

    expect(result).toMatchObject({
      allowed: false,
      remaining: 0,
      degraded: true,
    });
  });
});
