import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  CallConfigurationError,
  getIceConfiguration,
} from './webrtc';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('getIceConfiguration', () => {
  it('requires an authenticated TURN server for relay-only responses', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_ENV', 'production');
    const authFetch = vi.fn(async () =>
      Response.json({
        data: {
          ice_servers: [{ urls: ['stun:relay.example.com:3478'] }],
          ice_transport_policy: 'relay',
          relay_configured: false,
        },
      }),
    );

    await expect(getIceConfiguration(authFetch)).rejects.toBeInstanceOf(
      CallConfigurationError,
    );
  });

  it('rejects a direct-P2P response in production even if STUN is available', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_ENV', 'production');
    const authFetch = vi.fn(async () =>
      Response.json({
        data: {
          ice_servers: [{ urls: ['stun:stun.l.google.com:19302'] }],
          ice_transport_policy: 'all',
          relay_configured: false,
        },
      }),
    );

    await expect(getIceConfiguration(authFetch)).rejects.toBeInstanceOf(
      CallConfigurationError,
    );
  });

  it('uses relay-only transport when short-lived TURN credentials are present', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_ENV', 'production');
    const authFetch = vi.fn(async () =>
      Response.json({
        data: {
          ice_servers: [
            {
              urls: ['turns:relay.example.com:5349'],
              username: '1700000000:opaque',
              credential: 'short-lived-secret',
            },
          ],
          ice_transport_policy: 'relay',
          relay_configured: true,
        },
      }),
    );

    await expect(getIceConfiguration(authFetch)).resolves.toMatchObject({
      iceTransportPolicy: 'relay',
    });
  });

  it('accepts direct-P2P only when the authenticated BFF marks a dev fallback', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_ENV', 'production');
    const authFetch = vi.fn(async () =>
      Response.json({
        data: {
          ice_servers: [{ urls: ['stun:stun.l.google.com:19302'] }],
          ice_transport_policy: 'all',
          relay_configured: false,
          development_fallback: true,
        },
      }),
    );

    await expect(getIceConfiguration(authFetch)).resolves.toMatchObject({
      iceTransportPolicy: 'all',
    });
  });

  it('only falls back to public STUN in development or test', async () => {
    const authFetch = vi.fn(async () => {
      throw new Error('offline');
    });

    vi.stubEnv('NEXT_PUBLIC_APP_ENV', 'production');
    await expect(getIceConfiguration(authFetch)).rejects.toBeInstanceOf(
      CallConfigurationError,
    );

    vi.stubEnv('NEXT_PUBLIC_APP_ENV', 'development');
    await expect(getIceConfiguration(authFetch)).resolves.toMatchObject({
      iceTransportPolicy: 'all',
      iceServers: expect.arrayContaining([
        expect.objectContaining({ urls: expect.stringMatching(/^stun:/) }),
      ]),
    });
  });
});
