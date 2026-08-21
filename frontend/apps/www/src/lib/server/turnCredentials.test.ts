import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { createIceServerPayload } from './turnCredentials';

describe('TURN REST credentials', () => {
  it('creates an opaque, short-lived coturn credential', () => {
    const payload = createIceServerPayload('user-private-id', {
      turnUrls: 'turn:relay.example.com:3478,turns:relay.example.com:5349',
      stunUrls: 'stun:relay.example.com:3478',
      sharedSecret: 'server-only-secret',
      ttlSeconds: 600,
      nowSeconds: 1_000,
    });

    const turn = payload.ice_servers[1]!;
    expect(payload.expires_at).toBe(1_600);
    expect(payload.relay_configured).toBe(true);
    expect(turn.username).toMatch(/^1600:[a-f0-9]{20}$/);
    expect(turn.username).not.toContain('user-private-id');
    expect(turn.credential).toBe(
      createHmac('sha1', 'server-only-secret')
        .update(turn.username!)
        .digest('base64'),
    );
  });

  it('omits TURN when the server secret is unavailable', () => {
    const payload = createIceServerPayload('user', {
      turnUrls: 'turn:relay.example.com:3478',
      nowSeconds: 2_000,
    });

    expect(payload.relay_configured).toBe(false);
    expect(payload.development_fallback).toBe(true);
    expect(payload.ice_servers).toHaveLength(1);
    expect(payload.ice_servers[0]?.urls[0]).toMatch(/^stun:/);
    expect(payload.expires_at).toBe(5_600);
  });

  it('rejects untrusted URL schemes and bounds the TTL', () => {
    const payload = createIceServerPayload('user', {
      turnUrls: 'https://evil.example,turn:relay.example.com:3478 bad',
      sharedSecret: 'secret',
      ttlSeconds: 99_999,
      nowSeconds: 3_000,
    });

    expect(payload.relay_configured).toBe(false);
    expect(payload.expires_at).toBe(6_600);
  });

  it('does not expose public STUN or direct-P2P candidates in relay-only mode', () => {
    const configured = createIceServerPayload('user', {
      turnUrls: 'turns:relay.example.com:5349',
      stunUrls: 'stun:stun.l.google.com:19302',
      sharedSecret: 'secret',
      relayOnly: true,
      nowSeconds: 4_000,
    });
    const unavailable = createIceServerPayload('user', {
      stunUrls: 'stun:stun.l.google.com:19302',
      relayOnly: true,
      nowSeconds: 4_000,
    });

    expect(configured.ice_transport_policy).toBe('relay');
    expect(configured.development_fallback).toBe(false);
    expect(configured.ice_servers).toHaveLength(1);
    expect(configured.ice_servers[0]?.urls[0]).toMatch(/^turns:/);
    expect(unavailable.relay_configured).toBe(false);
    expect(unavailable.ice_servers).toEqual([]);
  });
});
