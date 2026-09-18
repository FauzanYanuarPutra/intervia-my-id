import { describe, expect, it } from 'vitest';
import {
  idempotencyFingerprint,
  resolveIdempotencyAttempt,
} from './client-idempotency';

describe('client idempotency attempt', () => {
  it('uses a canonical fingerprint regardless of object key order', () => {
    expect(idempotencyFingerprint({ amount: 10, note: 'x' })).toBe(
      idempotencyFingerprint({ note: 'x', amount: 10 }),
    );
  });

  it('reuses a key for an identical retry', () => {
    let counter = 0;
    const createKey = () => `key-${++counter}`;
    const first = resolveIdempotencyAttempt(null, { amount: 10 }, createKey);
    const retry = resolveIdempotencyAttempt(first, { amount: 10 }, createKey);

    expect(retry).toEqual(first);
    expect(counter).toBe(1);
  });

  it('creates a new key when the request meaning changes', () => {
    let counter = 0;
    const createKey = () => `key-${++counter}`;
    const first = resolveIdempotencyAttempt(null, { amount: 10 }, createKey);
    const changed = resolveIdempotencyAttempt(first, { amount: 11 }, createKey);

    expect(changed.key).not.toBe(first.key);
    expect(counter).toBe(2);
  });
});
