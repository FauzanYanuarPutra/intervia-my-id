import { afterEach, describe, expect, it, vi } from 'vitest';

import { getPublicWwwBaseUrl } from './portal-links';

describe('public www origin', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('uses the production www origin when the public URL is missing', () => {
    vi.stubEnv('NEXT_PUBLIC_WWW_URL', '');
    vi.stubEnv('NODE_ENV', 'production');
    expect(getPublicWwwBaseUrl()).toBe('https://www.lajukan.com');
  });

  it('rejects localhost as the public www URL in production', () => {
    vi.stubEnv('NEXT_PUBLIC_WWW_URL', 'http://localhost:3000');
    vi.stubEnv('NODE_ENV', 'production');
    expect(getPublicWwwBaseUrl()).toBe('https://www.lajukan.com');
  });

  it('keeps localhost available for local development', () => {
    vi.stubEnv('NEXT_PUBLIC_WWW_URL', '');
    vi.stubEnv('NODE_ENV', 'development');
    expect(getPublicWwwBaseUrl()).toBe('http://localhost:3000');
  });
});
