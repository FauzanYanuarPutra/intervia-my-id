import { describe, expect, it } from 'vitest';
import { normalizeRequestId, resolveRequestId } from './requestId';

describe('request id contract', () => {
  it('accepts bounded safe request ids', () => {
    expect(normalizeRequestId('edge-abc_123.456')).toBe('edge-abc_123.456');
  });

  it('rejects unsafe or unbounded request ids', () => {
    expect(normalizeRequestId('')).toBeNull();
    expect(normalizeRequestId('contains space')).toBeNull();
    expect(normalizeRequestId('a'.repeat(65))).toBeNull();
  });

  it('generates a request id when the incoming value is invalid', () => {
    expect(resolveRequestId('unsafe value')).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });
});
